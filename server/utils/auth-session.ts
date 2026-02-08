import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { deleteCookie, getCookie, setCookie } from 'h3'
import type { H3Event } from 'h3'

const AUTH_COOKIE_KEY = 'paneo.auth'
const AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

function getPassword(event: H3Event) {
  const config = useRuntimeConfig(event)
  return String(config.paneoAuthPassword || '').trim()
}

function getSecret(event: H3Event) {
  const config = useRuntimeConfig(event)
  const explicitSecret = String(config.paneoAuthSecret || '').trim()
  if (explicitSecret) {
    return explicitSecret
  }

  const password = getPassword(event)
  return createHash('sha256').update(`paneo-auth:${password}`).digest('hex')
}

function getCookieSecure(event: H3Event) {
  const config = useRuntimeConfig(event)
  return Boolean(config.paneoAuthCookieSecure)
}

function signPayload(payload: string, secret: string) {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) {
    return false
  }

  return timingSafeEqual(left, right)
}

export function authRequiresPassword(event: H3Event) {
  return getPassword(event).length > 0
}

export function verifyAuthPassword(event: H3Event, input: string) {
  const expected = getPassword(event)
  if (!expected) {
    return true
  }

  return safeEqual(String(input || ''), expected)
}

export function createAuthToken(event: H3Event) {
  const exp = Math.floor(Date.now() / 1000) + AUTH_COOKIE_MAX_AGE_SECONDS
  const payload = String(exp)
  const signature = signPayload(payload, getSecret(event))
  return `${payload}.${signature}`
}

export function setAuthSession(event: H3Event) {
  setCookie(event, AUTH_COOKIE_KEY, createAuthToken(event), {
    httpOnly: true,
    secure: getCookieSecure(event),
    sameSite: 'lax',
    path: '/',
    maxAge: AUTH_COOKIE_MAX_AGE_SECONDS
  })
}

export function clearAuthSession(event: H3Event) {
  deleteCookie(event, AUTH_COOKIE_KEY, {
    path: '/',
    secure: getCookieSecure(event),
    sameSite: 'lax'
  })
}

export function isAuthSessionValid(event: H3Event) {
  if (!authRequiresPassword(event)) {
    return true
  }

  const token = getCookie(event, AUTH_COOKIE_KEY)
  if (!token) {
    return false
  }

  const [expRaw, signature] = token.split('.')
  if (!expRaw || !signature) {
    return false
  }

  const exp = Number(expRaw)
  if (!Number.isFinite(exp) || exp <= Math.floor(Date.now() / 1000)) {
    return false
  }

  const expectedSignature = signPayload(expRaw, getSecret(event))
  return safeEqual(signature, expectedSignature)
}
