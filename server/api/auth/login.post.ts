import { authRequiresPassword, setAuthSession, verifyAuthPassword } from '~~/server/utils/auth-session'

export default defineEventHandler(async (event) => {
  const requiresPassword = authRequiresPassword(event)
  if (!requiresPassword) {
    return {
      success: true,
      requiresPassword: false,
      isAuthenticated: true
    }
  }

  const body = await readBody<{ password?: string }>(event)
  if (!verifyAuthPassword(event, body?.password || '')) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid password'
    })
  }

  setAuthSession(event)
  return {
    success: true,
    requiresPassword: true,
    isAuthenticated: true
  }
})
