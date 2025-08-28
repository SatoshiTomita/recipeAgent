import { defineEventHandler, readBody, createError } from 'h3'
import { $fetch } from 'ofetch'
import { getAdminAuth } from '../../utils/firebaseAdmin' // 下で作るヘルパ

type LineVerifyResponse = {
  iss: string
  sub: string          // ← LINEのユーザーID（これをFirebaseのuidに使う）
  aud: string
  exp: number
  iat: number
  nonce?: string
  amr?: string[]
  name?: string
  picture?: string
  email?: string
}

export default defineEventHandler(async (event) => {
  const { idToken } = await readBody<{ idToken?: string }>(event)
  if (!idToken) {
    throw createError({ statusCode: 400, statusMessage: 'idToken is required' })
  }

  const config = useRuntimeConfig()
  const channelId = config.lineChannelId || config.public?.lineChannelId
  if (!channelId) {
    throw createError({ statusCode: 500, statusMessage: 'LINE channelId not configured' })
  }

  // 1) LINE に ID トークンを検証してもらう
  const verify = await $fetch<LineVerifyResponse>('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    body: new URLSearchParams({
      id_token: idToken,
      client_id: channelId,
    }),
  }).catch((e) => {
    throw createError({ statusCode: 401, statusMessage: `LINE verify failed: ${e?.data?.error_description || e}` })
  })

  const lineUserId = verify.sub
  if (!lineUserId) {
    throw createError({ statusCode: 401, statusMessage: 'LINE verify missing sub' })
  }

  // 2) Firebase Admin で Custom Token を発行
  const auth = getAdminAuth()
  const customToken = await auth.createCustomToken(lineUserId, { provider: 'line' })

  return { customToken }
})
