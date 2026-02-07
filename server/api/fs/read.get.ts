import { getQuery } from 'h3'
import { readTextFile } from '~~/server/utils/file-manager'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const rootId = String(query.rootId || '')
  const path = String(query.path || '')

  if (!rootId || !path) {
    throw createError({ statusCode: 400, statusMessage: 'rootId and path are required' })
  }

  return await readTextFile(rootId, path)
})
