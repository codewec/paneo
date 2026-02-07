import { extname } from 'node:path'
import { open, stat } from 'node:fs/promises'
import { getQuery } from 'h3'
import { resolveWithinRoot } from '~~/server/utils/file-manager'

const MIME_BY_EXT: Record<string, string> = {
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.json': 'application/json',
  '.yaml': 'text/yaml',
  '.yml': 'text/yaml',
  '.xml': 'application/xml',
  '.csv': 'text/csv',
  '.log': 'text/plain',
  '.ini': 'text/plain',
  '.conf': 'text/plain',
  '.toml': 'text/plain',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.ts': 'text/plain',
  '.vue': 'text/plain',
  '.css': 'text/css',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.sh': 'text/plain',
  '.py': 'text/plain',
  '.go': 'text/plain',
  '.rs': 'text/plain',
  '.java': 'text/plain',
  '.c': 'text/plain',
  '.cpp': 'text/plain',
  '.h': 'text/plain',
  '.hpp': 'text/plain',
  '.sql': 'text/plain',
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
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogv': 'video/ogg',
  '.mov': 'video/quicktime',
  '.m4v': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.flac': 'audio/flac',
  '.aac': 'audio/aac',
  '.pdf': 'application/pdf'
}

async function detectMimeByContent(absPath: string) {
  const handle = await open(absPath, 'r')

  try {
    const sample = Buffer.alloc(2048)
    const { bytesRead } = await handle.read(sample, 0, sample.length, 0)
    const buffer = sample.subarray(0, bytesRead)

    const isBinary = buffer.includes(0)
    return isBinary ? 'application/octet-stream' : 'text/plain'
  } finally {
    await handle.close()
  }
}

function isTextMime(mimeType: string) {
  return mimeType.startsWith('text/')
    || mimeType === 'application/json'
    || mimeType === 'application/xml'
    || mimeType === 'application/javascript'
    || mimeType === 'text/javascript'
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

  const ext = extname(target.absPath).toLowerCase()
  const mimeType = MIME_BY_EXT[ext] || await detectMimeByContent(target.absPath)

  return {
    path: target.relativePath,
    mimeType,
    isText: isTextMime(mimeType)
  }
})
