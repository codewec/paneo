import { authRequiresPassword, isAuthSessionValid } from '~~/server/utils/auth-session'

export default defineEventHandler((event) => {
  const requiresPassword = authRequiresPassword(event)
  const isAuthenticated = isAuthSessionValid(event)

  return {
    requiresPassword,
    isAuthenticated
  }
})
