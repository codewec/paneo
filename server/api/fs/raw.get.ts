import { createReadStream } from 'node:fs'
import { extname } from 'node:path'
import { stat } from 'node:fs/promises'
import { getQuery, setHeader, sendStream } from 'h3'
import { resolveWithinRoot } from '~~/server/utils/file-manager'

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.avif': 'image/avif',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const rootId = String(query.rootId || '')
  const path = String(query.path || '')

  if (!rootId || !path) {
    throw createError({ statusCode: 400, statusMessage: 'rootId and path are required' })
  }

  const target = resolveWithinRoot(rootId, path)
  const targetStat = await stat(target.absPath)

  if (!targetStat.isFile()) {
    throw createError({ statusCode: 400, statusMessage: 'Target is not a file' })
  }

  const mime = MIME_BY_EXT[extname(target.absPath).toLowerCase()] || 'application/octet-stream'
  setHeader(event, 'content-type', mime)

  return sendStream(event, createReadStream(target.absPath))
})
