<!-- components/ScheduleRecipeButton.vue -->
<script setup lang="ts">
import { ref } from 'vue'
import { useScheduleRecipeNotify } from '~/composables/useScheduleRecipeNotify'
import { getAuth } from 'firebase/auth'

// ★ ハードコードしたJSTのISO文字列（必ず現在より未来にする）
const WHEN_FIXED = '2025-08-22T22:00:00+09:00' // ←必要に応じて書き換え

const { schedule } = useScheduleRecipeNotify()
const result = ref('')
const loading = ref(false)

async function onClick() {
  loading.value = true
  result.value = ''
  try {
    const uid = getAuth().currentUser?.uid
    if (!uid) throw new Error('ログインが必要です')

    // ★ 固定時刻をそのまま渡す
    const res = await schedule(uid, WHEN_FIXED)
    result.value = `予約OK: ${res.taskName}`
  } catch (e: any) {
    result.value = `予約失敗: ${e?.message ?? e}`
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="space-y-3">
    <div class="text-sm">
      固定送信時刻（JST）: <code>{{ '2025-08-22T22:00:00+09:00' }}</code>
    </div>
    <button :disabled="loading" @click="onClick" class="px-4 py-2 border rounded">
      {{ loading ? '予約中…' : '固定時刻で予約する' }}
    </button>
    <p class="text-sm text-gray-600 whitespace-pre-wrap">{{ result }}</p>
  </div>
</template>
