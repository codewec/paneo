import { getStartupStatus } from '~~/server/utils/startup-status'

export default defineEventHandler(async () => {
  return await getStartupStatus()
})
