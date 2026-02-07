import { getRoots } from '~~/server/utils/file-manager'

export default defineEventHandler(async () => {
  const roots = await getRoots()
  return { roots }
})
