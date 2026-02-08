import { authRequiresPassword, clearAuthSession } from '~~/server/utils/auth-session'

export default defineEventHandler((event) => {
  if (authRequiresPassword(event)) {
    clearAuthSession(event)
  }

  return {
    success: true
  }
})
