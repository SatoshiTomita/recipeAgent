import type { Liff } from '@line/liff'
import { getAuth, signInWithCustomToken } from 'firebase/auth'

export default defineNuxtPlugin((nuxtApp) => {
  let liffInstance: Liff | null = null

  const getLiff = async (): Promise<Liff> => {
    if (!process.client) throw new Error('LIFF is client-only')
    if (liffInstance) return liffInstance
    const mod = await import('@line/liff')
    liffInstance = mod.liff
    return liffInstance
  }

  // ★ ここで 'liffInit' を提供（呼ぶ側は $liffInit）
  nuxtApp.provide('liffInit', async (liffId: string, userId: string) => {
    if (!process.client) return null

    const pub = useRuntimeConfig().public as any
    const useMock = pub.liffUseMock === true

    try {
      const liff = await getLiff()

      if (useMock) {
        const { LiffMockPlugin } = await import('@line/liff-mock')
        liff.use(new LiffMockPlugin())
        await liff.init({ liffId, mock: true })
        if (!liff.isLoggedIn()) {
          liff.login()
          return { redirecting: true } as const
        }
      } else {
        await liff.init({ liffId })
        if (!liff.isLoggedIn()) {
          // LIFF の Endpoint URL と同一（クエリなし）
          const redirectTarget = `${location.origin}/liffEntry`
          liff.login({ redirectUri: redirectTarget })
          return { redirecting: true } as const
        }
      }

      const profile = await liff.getProfile()

      // Firebase サインイン
      const idToken = liff.getIDToken?.()
      if (!idToken) throw new Error('LIFF ID token を取得できませんでした')

      const { customToken } = await $fetch<{ customToken: string }>(
        '/api/auth/line',
        { method: 'POST', body: { idToken } }
      )
      await signInWithCustomToken(getAuth(), customToken)

      // 保存は best-effort
      try {
        await saveLiffUser(userId, {
          userId: profile.userId,
          displayName: profile.displayName,
          pictureUrl: profile.pictureUrl ?? '',
        } as LiffUser)
      } catch (e) {
        console.warn('saveLiffUser failed (ignored):', e)
      }

      return {
        userId: profile.userId,
        displayName: profile.displayName,
        pictureUrl: profile.pictureUrl ?? null,
      }
    } catch (e) {
      console.error('LIFF ログイン処理に失敗', e)
      return null
    }
  })
})
