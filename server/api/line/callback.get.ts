import { defineEventHandler, getQuery, getCookie, setCookie, createError, sendRedirect } from 'h3'
import { jwtVerify, createRemoteJWKSet } from 'jose'

export default defineEventHandler( async (event) => {
  const q = getQuery(event)
  const code  = String(q.code || '')
  const state = String(q.state || '')
  const err   = q.error

  if (err) throw createError({ statusCode: 400, statusMessage: String(err) })

  // state 検証
  const stateCookie = getCookie(event, 'line_login_state')
  if (!state || !stateCookie || state !== stateCookie) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid state' })
  }

  const { lineChannelId, lineChannelSecret, lineRedirectUri } = useRuntimeConfig()

  // code をトークンに交換
  const form = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: String(lineRedirectUri),
    client_id: String(lineChannelId),
    client_secret: String(lineChannelSecret),
  })

  const tokenRes = await $fetch<any>('https://api.line.me/oauth2/v2.1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  })

  const idToken = tokenRes.id_token as string
  if (!idToken) throw createError({ statusCode: 400, statusMessage: 'Missing id_token' })

  // IDトークン検証
  const jwks = createRemoteJWKSet(new URL('https://api.line.me/oauth2/v2.1/certs'))
  const { payload } = await jwtVerify(idToken, jwks, {
    audience: String(lineChannelId),
    issuer: 'https://access.line.me',
  })

  const nonceCookie = getCookie(event, 'line_login_nonce')
  if (!payload || payload.nonce !== nonceCookie) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid nonce' })
  }

  const lineUserId = String(payload.sub)

  // 一旦 Cookie に短期保存（フロントから /api/line/me で取得）
  const secure = process.env.NODE_ENV === 'production'
  setCookie(event, 'line_user_id_tmp', lineUserId, {
    httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: 300
  })

  const returnTo = getCookie(event, 'line_login_return') || '/'
  return sendRedirect(event, returnTo)
})
