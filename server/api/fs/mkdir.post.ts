import { readBody } from 'h3'
import { createDirectory } from '~~/server/utils/file-manager'

interface RequestBody {
  rootId?: string
  path?: string
  name?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<RequestBody>(event)

  if (!body?.rootId || !body.name) {
    throw createError({ statusCode: 400, statusMessage: 'rootId and name are required' })
  }

  await createDirectory(body.rootId, body.path || '', body.name)

  return { ok: true }
})
