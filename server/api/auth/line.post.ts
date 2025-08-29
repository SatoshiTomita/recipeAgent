// server/api/auth/line.post.ts
import { defineEventHandler, readBody, createError } from 'h3'
import { ofetch } from 'ofetch'
import { getAdminAuth } from '../../utils/firebaseAdmin'

type LineVerifyResponse = {
  iss: string
  sub: string
  aud: string
  exp: number
  iat: number
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<{ idToken?: string; targetUid?: string }>(event)
    console.log('[auth/line] body:', body) // ★ 受信確認

    const { idToken, targetUid } = body || {}
    if (!idToken) throw createError({ statusCode: 400, statusMessage: 'idToken is required' })
    if (!targetUid) throw createError({ statusCode: 400, statusMessage: 'targetUid is required' })

    const config = useRuntimeConfig()
    const channelId = (config as any).lineChannelId || (config.public as any)?.lineChannelId
    if (!channelId) throw createError({ statusCode: 500, statusMessage: 'LINE channelId not configured' })

    // 1) LINE 検証
    let verify: LineVerifyResponse
    try {
      verify = await ofetch<LineVerifyResponse>('https://api.line.me/oauth2/v2.1/verify', {
        method: 'POST',
        body: new URLSearchParams({ id_token: idToken, client_id: channelId }),
      })
      console.log('[auth/line] verify OK sub=', verify?.sub)
    } catch (e: any) {
      console.error('[auth/line] verify failed:', e?.data || e?.message || e)
      throw createError({ statusCode: 401, statusMessage: 'LINE verify failed' })
    }

    const lineUserId = verify?.sub
    if (!lineUserId) throw createError({ statusCode: 401, statusMessage: 'LINE verify missing sub' })

    // 2) 既存 uid (= targetUid) でトークン発行
    const auth = getAdminAuth()
    const customToken = await auth.createCustomToken(targetUid, {
      provider: 'line',
      lineUserId,
    })

    console.log('[auth/line] customToken issued for targetUid=', targetUid)
    return { customToken }
  } catch (err: any) {
    // 既に createError ならそのまま
    if (err?.statusCode) throw err
    console.error('[auth/line] unexpected error:', err)
    throw createError({ statusCode: 500, statusMessage: err?.message || 'auth/line failed' })
  }
})
