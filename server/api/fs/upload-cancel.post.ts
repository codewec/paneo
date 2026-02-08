import { readBody } from 'h3'
import { cleanupUploadTemp } from '~~/server/utils/file-manager'

interface UploadCancelBody {
  rootId?: string
  uploadIds?: string[]
}

export default defineEventHandler(async (event) => {
  const body = await readBody<UploadCancelBody>(event)
  const rootId = body?.rootId || ''
  const uploadIds = Array.isArray(body?.uploadIds)
    ? body.uploadIds.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : []

  if (!rootId) {
    throw createError({ statusCode: 400, statusMessage: 'rootId is required' })
  }

  if (!uploadIds.length) {
    return { ok: true, cleaned: 0 }
  }

  await Promise.allSettled(uploadIds.map(async (uploadId) => {
    await cleanupUploadTemp(rootId, uploadId)
  }))

  return {
    ok: true,
    cleaned: uploadIds.length
  }
})
