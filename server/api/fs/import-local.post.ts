import { readBody } from 'h3'
import { importLocalPaths } from '~~/server/utils/file-manager'

interface RequestBody {
  rootId?: string
  path?: string
  sourcePaths?: string[]
}

export default defineEventHandler(async (event) => {
  const body = await readBody<RequestBody>(event)

  if (!body?.rootId || typeof body.path !== 'string' || !Array.isArray(body.sourcePaths)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'rootId, path and sourcePaths are required'
    })
  }

  const result = await importLocalPaths(body.rootId, body.path, body.sourcePaths)
  return { ok: true, imported: result.imported }
})
