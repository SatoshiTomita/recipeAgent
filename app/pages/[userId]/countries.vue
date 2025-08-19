<script setup lang="ts">
import { ref, onMounted } from "vue"
import { getAuth, onAuthStateChanged } from "firebase/auth"
import { getFirestore, doc, getDoc } from "firebase/firestore"

const { countries } = useCountries()
const userStore = useUserInfoStore()

// 画面表示用（国名ラベル）と内部保持用（国コード）
const cuisine = ref<string | null>(null)       // 例: "日本"
const nationCode = ref<string | null>(null)    // 例: "JP"
const loading = ref(true)

const codeToLabel = (code: string | null | undefined) =>
  countries.find(c => c.code === code)?.label ?? null

const labelToCode = (label: string | null | undefined) =>
  countries.find(c => c.label === label)?.code ?? null

const hydrateFromFirestore = async (uid: string) => {
  const db = getFirestore()
  const snap = await getDoc(doc(db, "users", uid))
  const data = snap.data() || {}

  // Firestore 側は "JP" のようなコードを保存している想定
  const savedCode: string | undefined = data.nation

  // ストアに既に保持があればそれを優先、無ければ Firestore、どちらも無ければ null
  const code = userStore.state.value?.nation ?? savedCode ?? null

  nationCode.value = code
  cuisine.value = codeToLabel(code) ?? null

  // ストアも同期
  if (code) userStore.setNationLocal(code)

  // どちらにも無い場合のみ日本をフォールバック
  if (!code) {
    nationCode.value = "JP"
    cuisine.value = codeToLabel("JP") ?? "日本"
    userStore.setNationLocal("JP")
  }
}

const changeNation = async (country: { label: string; code: string }) => {
  const uid = getAuth().currentUser?.uid
  if (!uid) {
    console.error("未ログインです") // ← トーストに置き換えOK
    return
  }

  // Firestore 保存（コードを保存: "JP" など）
  await updateUserNation(uid, country.code)

  // ローカル状態とストアを更新
  nationCode.value = country.code
  cuisine.value = country.label
  userStore.setNationLocal(country.code)
}

onMounted(() => {
  const auth = getAuth()
  const current = auth.currentUser
  if (current?.uid) {
    hydrateFromFirestore(current.uid).finally(() => (loading.value = false))
  } else {
    const unSub = onAuthStateChanged(auth, (u) => {
      if (u?.uid) {
        hydrateFromFirestore(u.uid).finally(() => {
          loading.value = false
          unSub()
        })
      } else {
        // 未ログイン時は日本にフォールバック（必要に応じて未選択でもOK）
        nationCode.value = "JP"
        cuisine.value = codeToLabel("JP") ?? "日本"
        loading.value = false
      }
    })
  }
})
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-white to-gray-50 py-12 px-6">
    <div class="max-w-5xl mx-auto">
      <h2 class="text-3xl font-extrabold text-center text-gray-800 mb-10">
        🌍 作りたい料理の国を選択してください
      </h2>
      <div class="text-center mt-5 mb-5">
        <p class="text-gray-600 text-lg">
          選択中の国：
          <span class="font-bold text-green-600">
            {{ cuisine ?? '—' }}
          </span>
        </p>
      </div>

      <div v-if="loading" class="text-center text-gray-500">読み込み中…</div>

      <div
        v-else
        class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
      >
        <button
          v-for="country in countries"
          :key="country.code"
          @click="changeNation(country)"
          class="flex flex-col items-center justify-center px-4 py-3 rounded-xl border shadow-sm transition-all duration-200"
          :class="cuisine === country.label
            ? 'bg-green-500 text-white scale-105'
            : 'bg-white hover:bg-gray-100 text-gray-800'"
        >
          <img
            :src="`https://flagcdn.com/w80/${country.code.toLowerCase()}.png`"
            :alt="country.label"
            class="rounded"
          />
          <span class="text-sm font-medium text-center">{{ country.label }}</span>
        </button>
      </div>

      
    </div>
  </div>
</template>
