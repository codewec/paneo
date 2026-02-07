import { getQuery } from 'h3'
import { listDirectory } from '~~/server/utils/file-manager'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const rootId = String(query.rootId || '')
  const path = typeof query.path === 'string' ? query.path : ''

  if (!rootId) {
    throw createError({ statusCode: 400, statusMessage: 'rootId is required' })
  }

  return await listDirectory(rootId, path)
})
