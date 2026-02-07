import { readBody } from 'h3'
import { copyPath } from '~~/server/utils/file-manager'

interface RequestBody {
  fromRootId?: string
  fromPath?: string
  toRootId?: string
  toDirPath?: string
  newName?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<RequestBody>(event)

  if (!body?.fromRootId || !body.fromPath || !body.toRootId || typeof body.toDirPath !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'fromRootId, fromPath, toRootId and toDirPath are required'
    })
  }

  await copyPath(body.fromRootId, body.fromPath, body.toRootId, body.toDirPath, body.newName)

  return { ok: true }
})
