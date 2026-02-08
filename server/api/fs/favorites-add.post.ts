import { readBody } from 'h3'
import { addFavorite } from '~~/server/utils/favorites-store'

interface RequestBody {
  rootId?: string
  path?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<RequestBody>(event)

  if (!body?.rootId) {
    throw createError({ statusCode: 400, statusMessage: 'rootId is required' })
  }

  const items = await addFavorite(body.rootId, body.path || '')
  return { items }
})
