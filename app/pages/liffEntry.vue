<!-- pages/liffEntry.vue（または liffEntry ページ）-->
<script setup lang="ts">
import { getAuth, onAuthStateChanged, type User } from 'firebase/auth'

const nuxtApp: any = useNuxtApp()
const router = useRouter()
const route = useRoute()

const next = ref<string>('')
const liffId = ref<string>('')
const userId = ref<string>('')    // セッション/URL から渡される
const liffUser = ref<LiffUser>()
const isLoading = ref(true)
const fallbackCountdown = ref(10)
let countdownTimer: number | null = null

const safeGetSession = (key: string) => {
    if (!process.client) return ''
    try { return sessionStorage.getItem(key) || '' } catch { return '' }
}
const safeSetSession = (key: string, val: string) => {
    if (!process.client) return
    try { sessionStorage.setItem(key, val) } catch { }
}

function getCtxB64FromRoute(): string {
    // /liffEntry?ctx=... で来たケース（通常）
    if (typeof route.query.ctx === 'string') return route.query.ctx

    // /liffEntry?liff.state=?ctx=... で戻って来るケース（LIFF リダイレクト後）
    const ls = route.query['liff.state']
    if (typeof ls === 'string' && ls) {
        try {
            // 例: "?ctx=xxx" または "%3Fctx%3Dxxx" が入っている
            const decoded = decodeURIComponent(ls)
            const qs = decoded.startsWith('?') ? decoded.slice(1) : decoded
            const p = new URLSearchParams(qs)
            const v = p.get('ctx')
            if (typeof v === 'string') return v
        } catch { }
    }
    return ''
}
const ctx = ref<any>(null)
const loadLiffContext = () => {
    let raw = ''
    const ctxB64 = getCtxB64FromRoute()
    if (ctxB64) {
        try { raw = decodeURIComponent(atob(ctxB64)) } catch { }
        if (raw) try { sessionStorage.setItem('liff_context', raw) } catch { }
    }
    // 2) なければ sessionStorage から
    if (!raw) {
        try { raw = sessionStorage.getItem('liff_context') || '' } catch { }
    }
    if (!raw) return

    try {
        const parsed = JSON.parse(raw)
        ctx.value = parsed    
        userId.value = parsed.userId ?? ''
        next.value = parsed.next ?? ''
        liffId.value = parsed.liffId ?? ''
    } catch (e) {
        console.warn('liff_context parse failed', e)
    }
}

const startFallbackFlow = () => {
    isLoading.value = false
    fallbackCountdown.value = 10
    countdownTimer = window.setInterval(() => {
        if (fallbackCountdown.value <= 1) {
            if (countdownTimer) window.clearInterval(countdownTimer)
            router.replace('/')
        } else {
            fallbackCountdown.value -= 1
        }
    }, 1000)
}

// Firebase サインイン完了待ち
function waitForAuth(): Promise<User> {
    return new Promise((resolve, reject) => {
        const unsub = onAuthStateChanged(getAuth(), (u) => {
            if (u) { unsub(); resolve(u) }
        }, (err) => reject(err))
    })
}
const onLiffLogin = async (isSafeUri: boolean, nextUrl: string) => {
  try {
    if (isSafeUri) safeSetSession('next_after_login', nextUrl)

    const { $liffInit } = useNuxtApp()
    const result = await $liffInit(liffId.value, userId.value)
    if (result && (result as any).redirecting) return
    if (!result) return
    liffUser.value = result

    // ① ctx.destUid（最優先：飛ぶ前に確定させた Firebase uid）
    const ctxDestUid = ctx.value?.destUid as string | undefined

    // ② sessionStorage のバックアップ
    const preUid = safeGetSession('dest_uid')

    // ③ 念のため現在の Firebase ユーザーも取得（LINE で再ログインされてても拾える）
    const user = await waitForAuth()
    const currentUid = user.uid

    // ★優先順：ctx.destUid > session.dest_uid > currentUser.uid
    const finalUid = ctxDestUid || preUid || currentUid

    const storedNext = safeGetSession('next_after_login')
    let dest = storedNext.includes('/:uid')
      ? storedNext.replace('/:uid', `/${finalUid}`)
      : `/${finalUid}${storedNext.startsWith('/') ? storedNext : `/${storedNext}`}`

    if (!(dest.startsWith('/') && !dest.startsWith('//'))) dest = '/'

    // 後片付け（ctx/next/dest_uid はここで消す）
    if (process.client) {
      try {
        const cleanQuery = { ...route.query }
        delete (cleanQuery as any).ctx
        router.replace({ path: route.path, query: cleanQuery })
      } catch {}
    }
    try { sessionStorage.removeItem('next_after_login') } catch {}
    try { sessionStorage.removeItem('liff_context') } catch {}
    try { sessionStorage.removeItem('dest_uid') } catch {}
    safeSetSession('flashLiffSuccess', 'true')

    router.replace({ path: dest, query: { liff: 'true' } })
  } catch (e) {
    try { sessionStorage.removeItem('next_after_login') } catch {}
    console.error('ログイン処理に失敗', e)
    startFallbackFlow()
  } finally {
    setTimeout(() => { isLoading.value = false }, 300)
  }
}

onMounted(async () => {
    loadLiffContext()
    if (!userId.value) { console.error('ctx に userId なし'); startFallbackFlow(); return }
    if (!liffId.value) { console.error('ctx に liffId なし'); startFallbackFlow(); return }

    const decodedNext = decodeURIComponent(next.value || '')
    const isSafeNext = decodedNext.startsWith('/') && !decodedNext.startsWith('//')
    await onLiffLogin(isSafeNext, decodedNext)
})
</script>

<template>
    <div class="h-screen">
        <ClientOnly>
            <SharedLoading v-if="isLoading" :fullscreen="true" text="LINE に接続しています…" />
            <template #fallback>
                <!-- SSR中は同じ構造の空箱だけ返す -->
                <div class="h-screen"></div>
            </template>
        </ClientOnly>

        <div v-if="!isLoading" class="flex flex-col">
            <p class="pt-10 text-center text-xl">予期せぬエラーが発生しました</p>
            <p class="mt-2 text-center">残り: {{ fallbackCountdown }} 秒でトップに戻ります</p>
        </div>
    </div>
</template>