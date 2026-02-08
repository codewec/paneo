import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { createError } from 'h3'
import { resolveWithinRoot } from '~~/server/utils/file-manager'

export interface FavoriteFolder {
  rootId: string
  path: string
}

interface FavoriteFilePayload {
  items: FavoriteFolder[]
}

function normalizePath(path: string) {
  return String(path || '').trim().replace(/^\/+/, '').replace(/\\/g, '/')
}

function toKey(item: FavoriteFolder) {
  return `${item.rootId}:${item.path}`
}

const FAVORITES_STORAGE_FILE = '/var/lib/paneo/favorites.json'

async function readPayload() {
  const storagePath = FAVORITES_STORAGE_FILE

  try {
    const raw = await readFile(storagePath, 'utf-8')
    const parsed = JSON.parse(raw) as FavoriteFilePayload
    if (!parsed || !Array.isArray(parsed.items)) {
      return { storagePath, items: [] as FavoriteFolder[] }
    }

    const normalized = parsed.items
      .map(item => ({
        rootId: String(item?.rootId || '').trim(),
        path: normalizePath(String(item?.path || ''))
      }))
      .filter(item => item.rootId)

    return { storagePath, items: normalized }
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { storagePath, items: [] as FavoriteFolder[] }
    }

    throw error
  }
}

async function writePayload(storagePath: string, items: FavoriteFolder[]) {
  await mkdir(dirname(storagePath), { recursive: true })
  await writeFile(storagePath, JSON.stringify({ items }, null, 2), 'utf-8')
}

async function ensureExistingDirectory(rootId: string, path: string) {
  const target = resolveWithinRoot(rootId, path)
  const stats = await stat(target.absPath)

  if (!stats.isDirectory()) {
    throw createError({ statusCode: 400, statusMessage: 'Favorite target must be a directory' })
  }

  return target.relativePath
}

export async function listFavorites() {
  const { storagePath, items } = await readPayload()
  const unique = new Map<string, FavoriteFolder>()

  for (const item of items) {
    try {
      const normalizedPath = await ensureExistingDirectory(item.rootId, item.path)
      const normalizedItem = { rootId: item.rootId, path: normalizedPath }
      unique.set(toKey(normalizedItem), normalizedItem)
    } catch {
      // Skip entries that no longer exist or are inaccessible.
    }
  }

  const normalizedItems = Array.from(unique.values())

  if (normalizedItems.length !== items.length) {
    await writePayload(storagePath, normalizedItems)
  }

  return normalizedItems
}

export async function addFavorite(rootId: string, path: string) {
  const normalizedPath = await ensureExistingDirectory(rootId, path)
  const { storagePath, items } = await readPayload()
  const next = new Map(items.map(item => [toKey(item), item]))
  const favorite = { rootId, path: normalizedPath }

  next.set(toKey(favorite), favorite)

  const result = Array.from(next.values())
  await writePayload(storagePath, result)

  return result
}

export async function removeFavorite(rootId: string, path: string) {
  const normalizedPath = normalizePath(path)
  const { storagePath, items } = await readPayload()
  const next = items.filter(item => !(item.rootId === rootId && item.path === normalizedPath))

  await writePayload(storagePath, next)

  return next
}
