import { access, mkdir, readdir, readFile, rename, rm, stat, writeFile, cp } from 'node:fs/promises'
import { basename, isAbsolute, normalize, resolve, sep } from 'node:path'
import { createError } from 'h3'
import { useRuntimeConfig } from '#imports'

export interface FileRoot {
  id: string
  name: string
}

interface ResolvedRoot extends FileRoot {
  absPath: string
}

export interface FileListEntry {
  name: string
  path: string
  isDirectory: boolean
  size: number
  mtime: string
}

function getRootsFromConfig(): ResolvedRoot[] {
  const config = useRuntimeConfig()
  const raw = String(config.fileManagerRoots || '')

  const entries = raw
    .split(/[;\n]/)
    .map(item => item.trim())
    .filter(Boolean)

  if (!entries.length) {
    throw createError({
      statusCode: 500,
      statusMessage: 'FILE_MANAGER_ROOTS is empty'
    })
  }

  return entries.map((entry, index) => {
    const separatorIndex = entry.indexOf('=')
    const hasAlias = separatorIndex > 0
    const sourcePath = hasAlias ? entry.slice(separatorIndex + 1).trim() : entry
    const absPath = resolve(sourcePath)
    const name = hasAlias
      ? entry.slice(0, separatorIndex).trim() || basename(absPath)
      : basename(absPath) || absPath

    return {
      id: `root-${index + 1}`,
      name,
      absPath
    }
  })
}

export async function getRoots(): Promise<FileRoot[]> {
  const roots = getRootsFromConfig()

  await Promise.all(roots.map(async (root) => {
    const rootStats = await stat(root.absPath)
    if (!rootStats.isDirectory()) {
      throw createError({
        statusCode: 500,
        statusMessage: `Configured root is not a directory: ${root.absPath}`
      })
    }
  }))

  return roots.map(({ id, name }) => ({ id, name }))
}

function normalizeRelativePath(rawPath?: string | null): string {
  const input = (rawPath || '').trim()

  if (!input || input === '.') {
    return ''
  }

  if (isAbsolute(input)) {
    throw createError({ statusCode: 400, statusMessage: 'Absolute paths are not allowed' })
  }

  const normalized = normalize(input).replaceAll('\\', '/')

  if (normalized === '.' || !normalized) {
    return ''
  }

  if (normalized === '..' || normalized.startsWith('../') || normalized.includes('/../')) {
    throw createError({ statusCode: 400, statusMessage: 'Path traversal is not allowed' })
  }

  return normalized.replace(/^\.\//, '')
}

function getResolvedRoot(rootId: string): ResolvedRoot {
  const root = getRootsFromConfig().find(item => item.id === rootId)
  if (!root) {
    throw createError({ statusCode: 400, statusMessage: `Unknown root: ${rootId}` })
  }

  return root
}

export function resolveWithinRoot(rootId: string, relativePath?: string | null) {
  const root = getResolvedRoot(rootId)
  const safeRelativePath = normalizeRelativePath(relativePath)
  const absPath = resolve(root.absPath, safeRelativePath)
  const rootWithSep = root.absPath.endsWith(sep) ? root.absPath : `${root.absPath}${sep}`

  if (absPath !== root.absPath && !absPath.startsWith(rootWithSep)) {
    throw createError({ statusCode: 400, statusMessage: 'Path is outside configured root' })
  }

  return {
    root,
    relativePath: safeRelativePath,
    absPath
  }
}

export async function listDirectory(rootId: string, relativePath?: string | null) {
  const target = resolveWithinRoot(rootId, relativePath)
  const directoryStats = await stat(target.absPath)

  if (!directoryStats.isDirectory()) {
    throw createError({ statusCode: 400, statusMessage: 'Target is not a directory' })
  }

  const entries = await readdir(target.absPath, { withFileTypes: true })
  const mapped = await Promise.all(entries.map(async (entry) => {
    const childRelativePath = target.relativePath
      ? `${target.relativePath}/${entry.name}`
      : entry.name

    const child = resolveWithinRoot(rootId, childRelativePath)
    let childStat
    try {
      childStat = await stat(child.absPath)
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // Skip dangling symlinks or entries removed between readdir/stat.
        return null
      }
      throw error
    }

    const item: FileListEntry = {
      name: entry.name,
      path: child.relativePath,
      isDirectory: childStat.isDirectory(),
      size: childStat.isDirectory() ? 0 : childStat.size,
      mtime: childStat.mtime.toISOString()
    }

    return item
  }))
  const safeMapped = mapped.filter((item): item is FileListEntry => item !== null)

  safeMapped.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) {
      return a.isDirectory ? -1 : 1
    }

    return a.name.localeCompare(b.name)
  })

  const parentPath = target.relativePath
    ? normalizeRelativePath(target.relativePath.split('/').slice(0, -1).join('/'))
    : null

  return {
    rootId,
    rootName: target.root.name,
    path: target.relativePath,
    parentPath,
    entries: safeMapped
  }
}

export async function readTextFile(rootId: string, relativePath: string) {
  const target = resolveWithinRoot(rootId, relativePath)
  const fileStats = await stat(target.absPath)

  if (!fileStats.isFile()) {
    throw createError({ statusCode: 400, statusMessage: 'Target is not a file' })
  }

  if (fileStats.size > 2 * 1024 * 1024) {
    throw createError({ statusCode: 400, statusMessage: 'File is too large to edit in browser' })
  }

  const buffer = await readFile(target.absPath)
  const isBinary = buffer.subarray(0, 1024).includes(0)

  if (isBinary) {
    throw createError({ statusCode: 400, statusMessage: 'Binary file cannot be opened as text' })
  }

  return {
    path: target.relativePath,
    content: buffer.toString('utf-8')
  }
}

export async function writeTextFile(rootId: string, relativePath: string, content: string) {
  const target = resolveWithinRoot(rootId, relativePath)
  await writeFile(target.absPath, content, 'utf-8')
}

export async function createDirectory(rootId: string, basePath: string | null | undefined, name: string) {
  const cleanName = name.trim()
  if (!cleanName || cleanName.includes('/') || cleanName.includes('\\')) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid folder name' })
  }

  const base = resolveWithinRoot(rootId, basePath)
  const baseStats = await stat(base.absPath)
  if (!baseStats.isDirectory()) {
    throw createError({ statusCode: 400, statusMessage: 'Base path is not a directory' })
  }

  const targetPath = base.relativePath ? `${base.relativePath}/${cleanName}` : cleanName
  const target = resolveWithinRoot(rootId, targetPath)

  await mkdir(target.absPath)
}

async function ensureDestinationFree(absPath: string) {
  try {
    await access(absPath)
    throw createError({ statusCode: 409, statusMessage: 'Destination already exists' })
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return
    }

    throw error
  }
}

export async function deletePath(rootId: string, relativePath: string) {
  const target = resolveWithinRoot(rootId, relativePath)
  const targetStats = await stat(target.absPath)

  if (targetStats.isDirectory()) {
    await rm(target.absPath, { recursive: true, force: false })
    return
  }

  await rm(target.absPath, { force: false })
}

export async function copyPath(
  fromRootId: string,
  fromPath: string,
  toRootId: string,
  toDirectoryPath: string,
  newName?: string
) {
  const source = resolveWithinRoot(fromRootId, fromPath)
  const sourceStats = await stat(source.absPath)
  const destinationDir = resolveWithinRoot(toRootId, toDirectoryPath)
  const destinationDirStats = await stat(destinationDir.absPath)
  if (!destinationDirStats.isDirectory()) {
    throw createError({ statusCode: 400, statusMessage: 'Destination is not a directory' })
  }

  const targetName = (newName || source.relativePath.split('/').at(-1) || '').trim()
  if (!targetName || targetName.includes('/') || targetName.includes('\\')) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid target name' })
  }

  const destinationRelativePath = destinationDir.relativePath
    ? `${destinationDir.relativePath}/${targetName}`
    : targetName

  const destination = resolveWithinRoot(toRootId, destinationRelativePath)
  await ensureDestinationFree(destination.absPath)

  await cp(source.absPath, destination.absPath, {
    recursive: sourceStats.isDirectory(),
    force: false,
    errorOnExist: true
  })
}

export async function movePath(
  fromRootId: string,
  fromPath: string,
  toRootId: string,
  toDirectoryPath: string,
  newName?: string
) {
  const source = resolveWithinRoot(fromRootId, fromPath)
  const sourceStats = await stat(source.absPath)
  const destinationDir = resolveWithinRoot(toRootId, toDirectoryPath)
  const destinationDirStats = await stat(destinationDir.absPath)
  if (!destinationDirStats.isDirectory()) {
    throw createError({ statusCode: 400, statusMessage: 'Destination is not a directory' })
  }

  const targetName = (newName || source.relativePath.split('/').at(-1) || '').trim()
  if (!targetName || targetName.includes('/') || targetName.includes('\\')) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid target name' })
  }

  const destinationRelativePath = destinationDir.relativePath
    ? `${destinationDir.relativePath}/${targetName}`
    : targetName

  const destination = resolveWithinRoot(toRootId, destinationRelativePath)
  await ensureDestinationFree(destination.absPath)

  try {
    await rename(source.absPath, destination.absPath)
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== 'EXDEV') {
      throw error
    }

    await cp(source.absPath, destination.absPath, {
      recursive: sourceStats.isDirectory(),
      force: false,
      errorOnExist: true
    })

    await rm(source.absPath, {
      recursive: sourceStats.isDirectory(),
      force: false
    })
  }
}
