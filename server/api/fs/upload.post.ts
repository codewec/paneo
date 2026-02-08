import { appendFile, mkdir, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { getHeader, getQuery, readRawBody } from 'h3'
import { TEMP_UPLOAD_DIR, normalizeUploadFilePath, resolveWithinRoot, validateUploadId } from '~~/server/utils/file-manager'

function parsePositiveInt(value: string | undefined, field: string) {
  const parsed = Number.parseInt(value || '', 10)
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw createError({ statusCode: 400, statusMessage: `Invalid ${field}` })
  }
  return parsed
}

function getRequiredHeader(event: Parameters<typeof getHeader>[0], headerName: string) {
  const value = getHeader(event, headerName)
  if (!value) {
    throw createError({ statusCode: 400, statusMessage: `Missing ${headerName} header` })
  }
  return value
}

function decodeRelativePath(encoded: string) {
  try {
    return decodeURIComponent(encoded)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid x-file-path header' })
  }
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const rootId = typeof query.rootId === 'string' ? query.rootId : ''
  const path = typeof query.path === 'string' ? query.path : ''
  if (!rootId) {
    throw createError({ statusCode: 400, statusMessage: 'rootId is required' })
  }

  const uploadId = getRequiredHeader(event, 'x-upload-id')
  validateUploadId(uploadId)

  const filePathHeader = getRequiredHeader(event, 'x-file-path')
  const filePath = normalizeUploadFilePath(decodeRelativePath(filePathHeader))
  const chunkIndex = parsePositiveInt(getHeader(event, 'x-chunk-index') || undefined, 'x-chunk-index')
  const totalChunks = parsePositiveInt(getHeader(event, 'x-total-chunks') || undefined, 'x-total-chunks')
  if (totalChunks < 1 || chunkIndex >= totalChunks) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid chunk metadata' })
  }

  const base = resolveWithinRoot(rootId, path)
  const baseStats = await stat(base.absPath)
  if (!baseStats.isDirectory()) {
    throw createError({ statusCode: 400, statusMessage: 'Base path is not a directory' })
  }

  const tempDir = resolveWithinRoot(rootId, TEMP_UPLOAD_DIR)
  await mkdir(tempDir.absPath, { recursive: true })

  const targetRelativePath = base.relativePath ? `${base.relativePath}/${filePath}` : filePath
  const target = resolveWithinRoot(rootId, targetRelativePath)
  const tempFile = resolveWithinRoot(rootId, `${TEMP_UPLOAD_DIR}/${uploadId}.part`)

  const chunkData = await readRawBody(event, false)
  const chunk = chunkData || Buffer.alloc(0)

  if (chunkIndex === 0) {
    await writeFile(tempFile.absPath, chunk)
  } else {
    await appendFile(tempFile.absPath, chunk)
  }

  const completed = chunkIndex === totalChunks - 1
  if (completed) {
    await mkdir(dirname(target.absPath), { recursive: true })
    await rm(target.absPath, { force: true })
    await rename(tempFile.absPath, target.absPath)
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

  return {
    ok: true,
    completed
  }
})
