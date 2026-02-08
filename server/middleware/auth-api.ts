import { getRequestURL } from 'h3'
import { authRequiresPassword, isAuthSessionValid } from '~~/server/utils/auth-session'

export default defineEventHandler((event) => {
  if (!authRequiresPassword(event)) {
    return
  }

  const pathname = getRequestURL(event).pathname
  if (!pathname.startsWith('/api/')) {
    return
  }

  // Allow auth endpoints and internal icon API without authentication.
  if (pathname.startsWith('/api/auth/') || pathname.startsWith('/api/_nuxt_icon/')) {
    return
  }

  if (!isAuthSessionValid(event)) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }
})
