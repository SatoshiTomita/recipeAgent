import { defineEventHandler, getQuery, sendRedirect, setCookie } from 'h3'

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const returnTo = typeof q.returnTo === 'string' ? q.returnTo : '/'

  const { lineChannelId, lineRedirectUri } = useRuntimeConfig()

  // CSRF: state / OIDC: nonce
  const state = crypto.randomUUID()
  const nonce = crypto.randomUUID()
  const secure = process.env.NODE_ENV === 'production'

  setCookie(event, 'line_login_state', state, { httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: 600 })
  setCookie(event, 'line_login_nonce',  nonce, { httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: 600 })
  setCookie(event, 'line_login_return', returnTo, { httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: 600 })

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: String(lineChannelId),
    redirect_uri: String(lineRedirectUri),
    state,
    scope: 'openid profile',
    nonce,
    ui_locales: 'ja',
    // bot_prompt: 'normal',
    // prompt: 'consent',
  })

  return sendRedirect(event, `https://access.line.me/oauth2/v2.1/authorize?${params}`)
})
