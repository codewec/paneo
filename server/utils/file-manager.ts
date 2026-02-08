import { createReadStream, createWriteStream } from 'node:fs'
import { access, cp, mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, normalize, relative, resolve, sep } from 'node:path'
import { pipeline } from 'node:stream/promises'
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
export const TEMP_UPLOAD_DIR = '.paneo-upload-tmp'

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

export async function createFile(rootId: string, basePath: string | null | undefined, name: string) {
  const cleanName = name.trim()
  if (!cleanName || cleanName.includes('/') || cleanName.includes('\\')) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid file name' })
  }

  const base = resolveWithinRoot(rootId, basePath)
  const baseStats = await stat(base.absPath)
  if (!baseStats.isDirectory()) {
    throw createError({ statusCode: 400, statusMessage: 'Base path is not a directory' })
  }

  const targetPath = base.relativePath ? `${base.relativePath}/${cleanName}` : cleanName
  const target = resolveWithinRoot(rootId, targetPath)

  await writeFile(target.absPath, '', { encoding: 'utf-8', flag: 'wx' })
}

export function normalizeUploadFilePath(rawPath: string) {
  const normalized = normalizeRelativePath(rawPath.replaceAll('\\', '/').replace(/^\/+/, ''))
  if (!normalized) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid uploaded file path' })
  }

  return normalized
}

export function validateUploadId(uploadId: string) {
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(uploadId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid x-upload-id header' })
  }
}

export async function cleanupUploadTemp(rootId: string, uploadId: string) {
  validateUploadId(uploadId)

  const tempDir = resolveWithinRoot(rootId, TEMP_UPLOAD_DIR)
  const tempFile = resolveWithinRoot(rootId, TEMP_UPLOAD_DIR + '/' + uploadId + '.part')

  await rm(tempFile.absPath, { force: true })

  try {
    const remaining = await readdir(tempDir.absPath)
    if (!remaining.length) {
      await rm(tempDir.absPath, { recursive: true, force: true })
    }
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      throw error
    }
  }
}

export async function uploadFiles(rootId: string, basePath: string | null | undefined, files: Array<{ relativePath: string, data: Uint8Array }>) {
  if (!files.length) {
    return { uploaded: 0 }
  }

  const base = resolveWithinRoot(rootId, basePath)
  const baseStats = await stat(base.absPath)
  if (!baseStats.isDirectory()) {
    throw createError({ statusCode: 400, statusMessage: 'Base path is not a directory' })
  }

  let uploaded = 0
  for (const file of files) {
    const relativePath = normalizeUploadFilePath(file.relativePath)
    const targetPath = base.relativePath ? `${base.relativePath}/${relativePath}` : relativePath
    const target = resolveWithinRoot(rootId, targetPath)

    await mkdir(dirname(target.absPath), { recursive: true })
    await writeFile(target.absPath, file.data)
    uploaded += 1
  }

  return { uploaded }
}

export async function importLocalPaths(rootId: string, basePath: string | null | undefined, sourcePaths: string[]) {
  if (!sourcePaths.length) {
    return { imported: 0 }
  }

  const base = resolveWithinRoot(rootId, basePath)
  const baseStats = await stat(base.absPath)
  if (!baseStats.isDirectory()) {
    throw createError({ statusCode: 400, statusMessage: 'Base path is not a directory' })
  }

  let imported = 0
  for (const sourcePath of sourcePaths) {
    const normalizedSourcePath = sourcePath.trim()
    if (!normalizedSourcePath) {
      continue
    }

    if (!isAbsolute(normalizedSourcePath)) {
      throw createError({ statusCode: 400, statusMessage: `Source path must be absolute: ${normalizedSourcePath}` })
    }

    const sourceAbsPath = resolve(normalizedSourcePath)
    const sourceStats = await stat(sourceAbsPath)
    const targetName = basename(sourceAbsPath)
    if (!targetName) {
      throw createError({ statusCode: 400, statusMessage: `Invalid source path: ${normalizedSourcePath}` })
    }

    const targetPath = base.relativePath ? `${base.relativePath}/${targetName}` : targetName
    const target = resolveWithinRoot(rootId, targetPath)

    await rm(target.absPath, { recursive: true, force: true })
    await cp(sourceAbsPath, target.absPath, {
      recursive: sourceStats.isDirectory(),
      force: true,
      errorOnExist: false
    })
    imported += 1
  }

  return { imported }
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

async function pathExists(absPath: string) {
  try {
    await access(absPath)
    return true
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return false
    }

    throw error
  }
}

interface CopyStats {
  copiedFiles: number
  copiedDirectories: number
  skipped: number
}

export interface CopyProgress {
  totalFiles: number
  processedFiles: number
  copiedFiles: number
  skipped: number
  totalBytes: number
  processedBytes: number
  currentFile: string
  currentFileBytes: number
  currentFileTotalBytes: number
}

interface CopyState {
  sourceRootAbsPath: string
  totalFiles: number
  processedFiles: number
  copiedFiles: number
  copiedDirectories: number
  skipped: number
  totalBytes: number
  processedBytes: number
  currentFileBytes: number
  currentFileTotalBytes: number
  onProgress?: (progress: CopyProgress) => void
}

function throwIfAborted(signal?: AbortSignal) {
  if (!signal?.aborted) {
    return
  }

  const error = new Error('Copy canceled')
  ;(error as NodeJS.ErrnoException).code = 'ABORT_ERR'
  throw error
}

async function statSafe(absPath: string) {
  try {
    return await stat(absPath)
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null
    }

    throw error
  }
}

async function countCopyTotalsRecursive(absPath: string): Promise<{ files: number, bytes: number }> {
  const entryStats = await stat(absPath)
  if (!entryStats.isDirectory()) {
    return { files: 1, bytes: entryStats.size }
  }

  const entries = await readdir(absPath, { withFileTypes: true })
  let files = 0
  let bytes = 0

  for (const entry of entries) {
    const totals = await countCopyTotalsRecursive(resolve(absPath, entry.name))
    files += totals.files
    bytes += totals.bytes
  }

  return { files, bytes }
}

function normalizeDisplayPath(baseAbsPath: string, absPath: string) {
  const rel = relative(baseAbsPath, absPath).replaceAll('\\', '/')
  return rel || basename(absPath)
}

function emitProgress(state: CopyState, absPath: string) {
  state.onProgress?.({
    totalFiles: state.totalFiles,
    processedFiles: state.processedFiles,
    copiedFiles: state.copiedFiles,
    skipped: state.skipped,
    totalBytes: state.totalBytes,
    processedBytes: Math.max(0, Math.min(state.totalBytes, state.processedBytes)),
    currentFile: normalizeDisplayPath(state.sourceRootAbsPath, absPath),
    currentFileBytes: Math.max(0, Math.min(state.currentFileTotalBytes, state.currentFileBytes)),
    currentFileTotalBytes: state.currentFileTotalBytes
  })
}

async function copyFileWithAbort(
  sourceAbsPath: string,
  destinationAbsPath: string,
  signal?: AbortSignal,
  onChunk?: (chunkBytes: number, copiedBytes: number) => void
) {
  throwIfAborted(signal)

  const readStream = createReadStream(sourceAbsPath)
  const writeStream = createWriteStream(destinationAbsPath, { flags: 'w' })
  let copiedBytes = 0

  readStream.on('data', (chunk: Buffer | string) => {
    const chunkBytes = typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.byteLength
    copiedBytes += chunkBytes
    onChunk?.(chunkBytes, copiedBytes)
  })

  try {
    await pipeline(readStream, writeStream, { signal })
  } catch (error: unknown) {
    await rm(destinationAbsPath, { force: true }).catch(() => undefined)
    if ((error as NodeJS.ErrnoException).code === 'ABORT_ERR' || signal?.aborted) {
      throwIfAborted(signal)
    }
    throw error
  }
}

async function copyEntryWithMerge(
  sourceAbsPath: string,
  destinationAbsPath: string,
  overwriteExisting: boolean,
  state: CopyState,
  signal?: AbortSignal
): Promise<CopyStats> {
  throwIfAborted(signal)

  const sourceStats = await stat(sourceAbsPath)
  const destinationStats = await statSafe(destinationAbsPath)

  if (sourceStats.isDirectory()) {
    if (destinationStats) {
      if (!destinationStats.isDirectory()) {
        if (!overwriteExisting) {
          const skippedTotals = await countCopyTotalsRecursive(sourceAbsPath)
          state.skipped += skippedTotals.files
          state.processedFiles += skippedTotals.files
          state.processedBytes += skippedTotals.bytes
          state.currentFileBytes = 0
          state.currentFileTotalBytes = 0
          emitProgress(state, sourceAbsPath)
          return { copiedFiles: 0, copiedDirectories: 0, skipped: skippedTotals.files }
        }
        await rm(destinationAbsPath, { recursive: true, force: false })
        await mkdir(destinationAbsPath, { recursive: true })
      }
    } else {
      await mkdir(destinationAbsPath, { recursive: true })
    }

    const children = await readdir(sourceAbsPath, { withFileTypes: true })
    const total: CopyStats = {
      copiedFiles: 0,
      copiedDirectories: 1,
      skipped: 0
    }
    state.copiedDirectories += 1

    for (const child of children) {
      throwIfAborted(signal)
      const result = await copyEntryWithMerge(
        resolve(sourceAbsPath, child.name),
        resolve(destinationAbsPath, child.name),
        overwriteExisting,
        state,
        signal
      )
      total.copiedFiles += result.copiedFiles
      total.copiedDirectories += result.copiedDirectories
      total.skipped += result.skipped
    }

    return total
  }

  state.currentFileTotalBytes = sourceStats.size
  state.currentFileBytes = 0

  if (destinationStats) {
    if (destinationStats.isDirectory()) {
      if (!overwriteExisting) {
        state.skipped += 1
        state.processedFiles += 1
        state.processedBytes += sourceStats.size
        state.currentFileBytes = sourceStats.size
        emitProgress(state, sourceAbsPath)
        return { copiedFiles: 0, copiedDirectories: 0, skipped: 1 }
      }

      await rm(destinationAbsPath, { recursive: true, force: false })
    } else if (!overwriteExisting) {
      state.skipped += 1
      state.processedFiles += 1
      state.processedBytes += sourceStats.size
      state.currentFileBytes = sourceStats.size
      emitProgress(state, sourceAbsPath)
      return { copiedFiles: 0, copiedDirectories: 0, skipped: 1 }
    }
  }

  emitProgress(state, sourceAbsPath)
  const processedBytesBefore = state.processedBytes
  await copyFileWithAbort(sourceAbsPath, destinationAbsPath, signal, (_chunkBytes, copiedBytes) => {
    state.currentFileBytes = copiedBytes
    state.processedBytes = processedBytesBefore + copiedBytes
    emitProgress(state, sourceAbsPath)
  })

  state.copiedFiles += 1
  state.processedFiles += 1
  state.currentFileBytes = sourceStats.size
  state.processedBytes = processedBytesBefore + sourceStats.size
  emitProgress(state, sourceAbsPath)

  return {
    copiedFiles: 1,
    copiedDirectories: 0,
    skipped: 0
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
  newName?: string,
  overwriteExisting = true,
  signal?: AbortSignal,
  onProgress?: (progress: CopyProgress) => void
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
  if (source.absPath === destination.absPath) {
    throw createError({ statusCode: 400, statusMessage: 'Source and destination are the same' })
  }

  const copyTotals = sourceStats.isDirectory()
    ? await countCopyTotalsRecursive(source.absPath)
    : { files: 1, bytes: sourceStats.size }

  if (!sourceStats.isDirectory()) {
    const destinationExists = await pathExists(destination.absPath)
    if (destinationExists && !overwriteExisting) {
      onProgress?.({
        totalFiles: copyTotals.files,
        processedFiles: copyTotals.files,
        copiedFiles: 0,
        skipped: 1,
        totalBytes: copyTotals.bytes,
        processedBytes: copyTotals.bytes,
        currentFile: basename(source.absPath),
        currentFileBytes: copyTotals.bytes,
        currentFileTotalBytes: copyTotals.bytes
      })
      return { copiedFiles: 0, copiedDirectories: 0, skipped: 1 }
    }
  }

  const state: CopyState = {
    sourceRootAbsPath: source.absPath,
    totalFiles: copyTotals.files,
    processedFiles: 0,
    copiedFiles: 0,
    copiedDirectories: 0,
    skipped: 0,
    totalBytes: copyTotals.bytes,
    processedBytes: 0,
    currentFileBytes: 0,
    currentFileTotalBytes: 0,
    onProgress
  }

  onProgress?.({
    totalFiles: state.totalFiles,
    processedFiles: 0,
    copiedFiles: 0,
    skipped: 0,
    totalBytes: state.totalBytes,
    processedBytes: 0,
    currentFile: '',
    currentFileBytes: 0,
    currentFileTotalBytes: 0
  })

  const result = await copyEntryWithMerge(source.absPath, destination.absPath, overwriteExisting, state, signal)
  onProgress?.({
    totalFiles: state.totalFiles,
    processedFiles: state.processedFiles,
    copiedFiles: state.copiedFiles,
    skipped: state.skipped,
    totalBytes: state.totalBytes,
    processedBytes: state.processedBytes,
    currentFile: '',
    currentFileBytes: 0,
    currentFileTotalBytes: 0
  })
  return result
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
