import { readBody } from 'h3'
import { deletePath } from '~~/server/utils/file-manager'

interface RequestBody {
  rootId?: string
  path?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<RequestBody>(event)

  if (!body?.rootId || !body.path) {
    throw createError({ statusCode: 400, statusMessage: 'rootId and path are required' })
  }

  await deletePath(body.rootId, body.path)

  return { ok: true }
})
