import { readBody } from 'h3'
import { startCopyJob } from '~~/server/utils/copy-jobs'

interface RequestBody {
  fromRootId?: string
  fromPath?: string
  toRootId?: string
  toDirPath?: string
  newName?: string
  overwriteExisting?: boolean
}

export default defineEventHandler(async (event) => {
  const body = await readBody<RequestBody>(event)

  if (!body?.fromRootId || !body.fromPath || !body.toRootId || typeof body.toDirPath !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'fromRootId, fromPath, toRootId and toDirPath are required'
    })
  }

  return startCopyJob({
    fromRootId: body.fromRootId,
    fromPath: body.fromPath,
    toRootId: body.toRootId,
    toDirPath: body.toDirPath,
    newName: body.newName,
    overwriteExisting: body.overwriteExisting
  })
})
