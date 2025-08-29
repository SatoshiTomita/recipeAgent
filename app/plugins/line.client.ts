// plugins/line.client.ts
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

  nuxtApp.provide('liffInit', async (liffId: string, _userIdFromUrl: string) => {
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
          const redirectTarget = `${location.origin}/liffEntry`
          liff.login({ redirectUri: redirectTarget })
          return { redirecting: true } as const
        }
      }

      // --- LIFF 認証成功 ---
      const profile = await liff.getProfile()
      const idToken = liff.getIDToken?.()
      if (!idToken) throw new Error('LIFF ID token を取得できませんでした')

      // 飛ぶ前に保存した Firebase uid を取り出す
      // plugins/line.client.ts の抜粋
      const readDestUid = (): string | undefined => {
        try {
          const raw = sessionStorage.getItem('liff_context')
          if (raw) return (JSON.parse(raw) as any)?.destUid as string | undefined
        } catch { }
        try {
          return sessionStorage.getItem('dest_uid') || undefined
        } catch { }
        return undefined
      }
      const targetUid = readDestUid() || getAuth().currentUser?.uid
      if (!targetUid) throw new Error('targetUid not found')

      console.log('[client] calling /api/auth/line with targetUid=', targetUid)

      const { customToken } = await $fetch<{ customToken: string }>('/api/auth/line', {
        method: 'POST',
        body: { idToken, targetUid }, // ★ サーバと整合
      })
      await signInWithCustomToken(getAuth(), customToken)


      // 念のため一致チェック
      const authUid = getAuth().currentUser?.uid
      if (authUid !== targetUid) {
        throw new Error(`Auth uid mismatch: ${authUid} !== ${targetUid}`)
      }

       saveLiffUser({ targetUid, user: { userId: profile.userId ?? '', displayName: profile.displayName ?? '', pictureUrl: profile.pictureUrl ?? null } })

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
