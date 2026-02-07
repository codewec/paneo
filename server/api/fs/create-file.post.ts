import { readBody } from 'h3'
import { createFile } from '~~/server/utils/file-manager'

interface RequestBody {
  rootId?: string
  path?: string
  name?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<RequestBody>(event)

  if (!body?.rootId || typeof body.path !== 'string' || !body.name) {
    throw createError({
      statusCode: 400,
      statusMessage: 'rootId, path and name are required'
    })
  }

  await createFile(body.rootId, body.path, body.name)

  return { ok: true }
})
