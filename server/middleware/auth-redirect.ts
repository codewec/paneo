import { getRequestURL, sendRedirect } from 'h3'
import { authRequiresPassword, isAuthSessionValid } from '~~/server/utils/auth-session'

function isHtmlRoute(pathname: string) {
  if (pathname.startsWith('/api/')) {
    return false
  }

  if (pathname.startsWith('/_nuxt/')) {
    return false
  }

  if (pathname.startsWith('/__nuxt')) {
    return false
  }

  if (pathname === '/favicon.ico' || pathname.startsWith('/favicon.')) {
    return false
  }

  if (pathname.includes('.')) {
    return false
  }

  return true
}

export default defineEventHandler((event) => {
  const url = getRequestURL(event)
  if (!isHtmlRoute(url.pathname)) {
    return
  }

  if (!authRequiresPassword(event)) {
    if (url.pathname === '/auth') {
      return sendRedirect(event, '/', 302)
    }
    return
  }

  const isAuthPage = url.pathname === '/auth'
  const isAuthenticated = isAuthSessionValid(event)

  if (!isAuthenticated && !isAuthPage) {
    const redirectTo = encodeURIComponent(`${url.pathname}${url.search}`)
    return sendRedirect(event, `/auth?redirect=${redirectTo}`, 302)
  }

  if (isAuthenticated && isAuthPage) {
    const requested = url.searchParams.get('redirect') || '/'
    let decoded = requested
    try {
      decoded = decodeURIComponent(requested)
    } catch {
      decoded = requested
    }
    const target = decoded.startsWith('/') ? decoded : '/'
    return sendRedirect(event, target, 302)
  }
})
