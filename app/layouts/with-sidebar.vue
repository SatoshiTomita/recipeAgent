<!-- layouts/with-sidebar.vue -->
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getAuth, onAuthStateChanged, signOut, type User } from 'firebase/auth'

const route = useRoute()
const router = useRouter()

// ルート変更にも追従するように computed で取得
const userId = computed(() => String(route.params.userId ?? ''))

// 折りたたみ状態
const collapsed = ref(false)

// ナビ（userId 変化に追従）
const nav = computed(() => [
  { label: 'ホーム',     to: `/${userId.value}`,          icon: 'mdi:home-outline' },
  { label: 'OCR',        to: `/${userId.value}/ocr`,      icon: 'mdi:text-recognition' },
  { label: 'スケジュール', to: `/${userId.value}/schedule`, icon: 'mdi:calendar-clock' },
  { label: 'レシピ設定', to: `/${userId.value}/preference`, icon: 'mdi:tune' },
])

// アクティブ判定：ホームは完全一致、それ以外は startsWith で子ルートも可
const isActive = (to: string) => {
  const homePath = `/${userId.value}`
  if (to === homePath) return route.path === to
  return route.path === to || route.path.startsWith(to + '/')
}

// 折りたたみ時は title を出してツールチップ代わりに
const itemTitle = (label: string) => (collapsed.value ? label : undefined)

// 幅の切替
const asideWidth = computed(() => (collapsed.value ? 'w-16' : 'w-56'))

// ----- Auth state（ログアウトボタンの有効/無効に使う） -----
const authReady = ref(false)
const currentUser = ref<User | null>(null)
let unsub: (() => void) | null = null

onMounted(() => {
  const auth = getAuth()
  unsub = onAuthStateChanged(auth, (u) => {
    currentUser.value = u
    authReady.value = true
  })
})
onUnmounted(() => { if (unsub) unsub() })

// ログアウト処理
const loggingOut = ref(false)
async function handleLogout() {
  if (!authReady.value || loggingOut.value) return
  loggingOut.value = true
  try {
    await signOut(getAuth())
    // ログインページやトップへ遷移（任意で変更）
    await router.push('/login')
  } catch (e) {
    console.error('logout failed:', e)
  } finally {
    loggingOut.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex bg-gray-50">
    <!-- Sidebar -->
    <aside
      class="sticky top-0 h-screen shrink-0 border-r bg-white/80 backdrop-blur px-2 py-4 transition-all"
      :class="[asideWidth]"
    >
      <!-- 内部は縦並び・全高で配置制御 -->
      <div class="flex h-full flex-col">
        <!-- ヘッダー（タイトル） -->
        <div class="mb-4 px-2 flex items-center gap-2">
          <Icon name="mdi:chef-hat" class="text-xl" />
          <span v-if="!collapsed" class="text-sm font-semibold tracking-tight">メニュー</span>
        </div>

        <!-- Nav -->
        <nav class="flex flex-col gap-2">
          <NuxtLink
            v-for="item in nav"
            :key="item.to"
            :to="item.to"
            class="group rounded-xl px-2 py-2 text-sm transition flex items-center gap-3"
            :class="isActive(item.to)
              ? 'bg-black text-white'
              : 'text-gray-700 hover:bg-gray-100'"
            :title="itemTitle(item.label)"
          >
            <Icon :name="item.icon" class="text-lg shrink-0" />
            <span v-if="!collapsed" class="truncate">{{ item.label }}</span>
          </NuxtLink>
        </nav>

        <!-- Bottom actions：ログアウト + 折りたたみ（常に下部） -->
        <div class="mt-auto border-t pt-3 px-2 space-y-2">
          <!-- ログアウト -->
          <button
            class="group w-full rounded-lg px-2 py-2 flex items-center gap-2 transition
                   text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
            :class="collapsed ? 'justify-center' : 'justify-start'"
            :disabled="!authReady || !currentUser || loggingOut"
            @click="handleLogout"
            :title="collapsed ? 'ログアウト' : undefined"
          >
            <Icon name="mdi:logout" class="text-xl" />
            <span v-if="!collapsed" class="text-sm">
              {{ loggingOut ? 'ログアウト中…' : 'ログアウト' }}
            </span>
          </button>

          <!-- サイドバーの開閉 -->
          <button
            class="group w-full rounded-lg px-2 py-2 hover:bg-gray-100 text-gray-700
                   flex items-center gap-2 transition focus-visible:outline-none
                   focus-visible:ring-2 focus-visible:ring-black/30"
            :class="collapsed ? 'justify-center' : 'justify-start'"
            :aria-label="collapsed ? 'サイドバーを展開' : 'サイドバーを折りたたむ'"
            :title="collapsed ? 'サイドバーを展開' : 'サイドバーを折りたたむ'"
            @click="collapsed = !collapsed"
          >
            <Icon
              :name="collapsed ? 'mdi:chevron-right-circle' : 'mdi:chevron-left-circle'"
              class="text-2xl transition-transform duration-150 group-hover:scale-110"
            />
            <span v-if="!collapsed" class="text-sm">サイドバーを折りたたむ</span>
          </button>
        </div>
      </div>
    </aside>

    <!-- Main -->
    <div class="flex-1 flex flex-col">
      <!-- Top bar title -->
      <header class="border-b bg-white/70 backdrop-blur">
        <div class="px-6 py-4">
          <h1 class="text-lg font-semibold tracking-tight">
            {{ (route.meta.title as string) || 'ページ' }}
          </h1>
        </div>
      </header>

      <!-- Page content -->
      <main class="p-6">
        <slot />
      </main>
    </div>
  </div>
</template>
