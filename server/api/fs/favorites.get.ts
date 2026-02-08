import { listFavorites } from '~~/server/utils/favorites-store'

export default defineEventHandler(async () => {
  const items = await listFavorites()
  return { items }
})
