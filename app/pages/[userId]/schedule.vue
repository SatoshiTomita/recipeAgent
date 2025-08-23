<!-- components/ScheduleRecipeForm.vue -->
<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { getAuth, onAuthStateChanged, type User } from 'firebase/auth'
import { useScheduleRecipeNotify } from '~/composables/useScheduleRecipeNotify'

const { createSchedule, createDailyRule } = useScheduleRecipeNotify()
const loading = ref(false)
const result = ref('')

// 固定の LINE ユーザーID
const lineUserId = ref('Uc74738b6f58a62a18f4773828d53346a')

// ---- Auth ----
const authReady = ref(false)
const currentUser = ref<User | null>(null)
onMounted(() => {
  const unsub = onAuthStateChanged(getAuth(), (u) => { currentUser.value = u; authReady.value = true; unsub() })
})
const ensureUser = () => new Promise<User | null>((resolve) => {
  if (currentUser.value) return resolve(currentUser.value)
  const unsub = onAuthStateChanged(getAuth(), (u) => { unsub(); resolve(u) })
})

// 共通
const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
const hm  = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

// 単発 or 毎日
const mode = ref<'oneoff' | 'daily'>('oneoff')

/* ========= 単発 ========= */
const tzLabel = '(JST +09:00)'
const today = new Date()
const dateStr = ref(ymd(today))
const timeStr = ref(hm(today))
const maxDate = computed(() => { const d = new Date(); d.setDate(d.getDate()+30); return ymd(d) })
const errorOneoff = ref<string | null>(null)

watch([dateStr, timeStr], () => {
  errorOneoff.value = null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr.value)) { errorOneoff.value = '日付の形式が正しくありません'; return }
  if (!/^\d{2}:\d{2}$/.test(timeStr.value)) { errorOneoff.value = '時刻の形式が正しくありません'; return }
  const combined = new Date(`${dateStr.value}T${timeStr.value}`)
  if (!Number.isFinite(combined.getTime())) { errorOneoff.value = '日時が無効です'; return }
  const max = new Date(maxDate.value + 'T23:59')
  if (combined.getTime() > max.getTime()) { errorOneoff.value = '30日以内の日時のみ予約できます'; return }
  if (combined.getTime() <= Date.now()) { errorOneoff.value = '現在以降の日時を指定してください'; return }
})

const previewIsoJst = computed(() => {
  if (errorOneoff.value) return '—'
  const d = new Date(`${dateStr.value}T${timeStr.value}`)
  if (!Number.isFinite(d.getTime())) return '—'
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}+09:00`
})

/* ========= 毎日 ========= */
const dailyStartDate = ref(ymd(today))   // 初回単発生成に使用
const tz = ref('Asia/Tokyo')
const errorDaily = ref<string | null>(null)

const selectedTimes = ref<Set<string>>(new Set(['07:30']))
const maxDaily = 8
const canAddMore = computed(() => selectedTimes.value.size < maxDaily)
const timesSorted = computed(() => Array.from(selectedTimes.value).sort((a,b)=>a.localeCompare(b)))

// time入力（Enterでも追加）
const dailyTimeInput = ref('07:30')
function addDailyTime() {
  errorDaily.value = null
  const m = dailyTimeInput.value?.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) { errorDaily.value = 'HH:mm 形式で入力してください'; return }
  const h = Math.max(0, Math.min(23, parseInt(m[1], 10)))
  const mm = Math.max(0, Math.min(59, parseInt(m[2], 10)))
  const t = `${pad(h)}:${pad(mm)}`
  if (selectedTimes.value.has(t)) { errorDaily.value = `${t} は追加済みです`; return }
  if (!canAddMore.value) { errorDaily.value = `最大 ${maxDaily} 件までです`; return }
  selectedTimes.value.add(t)
}
function removeTime(t: string) { selectedTimes.value.delete(t) }

// 初回分の最短1件（開始日＋選択時刻）
function nextOccurrenceFrom(startYmd: string, hhmmList: string[]): Date {
  const now = new Date()
  const base = new Date(`${startYmd}T00:00`)
  const sorted = hhmmList
    .map(t => t.split(':').map(Number) as [number, number])
    .sort(([h1,m1],[h2,m2]) => h1 - h2 || m1 - m2)

  for (let d = 0; d <= 31; d++) {
    const day = new Date(base); day.setDate(base.getDate() + d)
    for (const [h, m] of sorted) {
      const cand = new Date(day); cand.setHours(h, m, 0, 0)
      if (cand.getTime() > now.getTime()) return cand
    }
  }
  // fallback: 明日の最初
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate()+1)
  const [h, m] = sorted[0] ?? [9, 0]
  tomorrow.setHours(h, m, 0, 0)
  return tomorrow
}

/* ========= 送信 ========= */
async function onSubmit() {
  loading.value = true
  result.value = ''
  try {
    const user = await ensureUser()
    if (!user) throw new Error('ログインが必要です')

    if (mode.value === 'oneoff') {
      if (errorOneoff.value) throw new Error(errorOneoff.value)
      const when = new Date(`${dateStr.value}T${timeStr.value}`)
      const { scheduleId } = await createSchedule({ userId: user.uid, when, lineUserId: lineUserId.value })
      result.value = `単発予約を作成: ${scheduleId}`
    } else {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dailyStartDate.value)) throw new Error('開始日が不正です')
      if (!selectedTimes.value.size) throw new Error('時刻を1つ以上追加してください')
      if (selectedTimes.value.size > maxDaily) throw new Error(`1日あたり最大 ${maxDaily} 件までです`)
      const cleaned = timesSorted.value

      const { ruleId } = await createDailyRule({
        userId: user.uid,
        lineUserId: lineUserId.value,
        times: cleaned,
        tz: tz.value,
      })

      const firstWhen = nextOccurrenceFrom(dailyStartDate.value, cleaned)
      const { scheduleId } = await createSchedule({ userId: user.uid, when: firstWhen, lineUserId: lineUserId.value })
      result.value = `毎日ルールを作成: ${ruleId}\n初回分の予約を作成: ${scheduleId}`
    }
  } catch (e: any) {
    result.value = `エラー: ${e?.message ?? e}`
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-2xl">
    <!-- Header -->
    <div class="mb-6">
      <h2 class="text-xl font-semibold tracking-tight">レシピ通知の予約</h2>
      <p class="text-sm text-gray-500">単発または毎日を選び、日時を設定してください。</p>
    </div>

    <!-- Mode segmented -->
    <div class="inline-flex rounded-xl bg-gray-100 p-1 mb-4 shadow-inner">
      <button
        class="px-4 py-2 rounded-lg text-sm transition
               " :class="mode==='oneoff' ? 'bg-white shadow text-black' : 'text-gray-600 hover:text-black'"
        @click="mode='oneoff'">単発</button>
      <button
        class="px-4 py-2 rounded-lg text-sm transition
               " :class="mode==='daily' ? 'bg-white shadow text-black' : 'text-gray-600 hover:text-black'"
        @click="mode='daily'">毎日</button>
    </div>

    <!-- Card -->
    <div class="rounded-2xl border bg-white/70 backdrop-blur p-5 shadow-sm space-y-6">
      <!-- ONE-OFF -->
      <div v-if="mode==='oneoff'" class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">日付 <span class="text-gray-400">{{ tzLabel }}</span></label>
            <input type="date" v-model="dateStr" :min="ymd(new Date())" :max="maxDate"
                   class="w-full rounded-xl border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/70" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">時刻</label>
            <input type="time" v-model="timeStr" step="60"
                   class="w-full rounded-xl border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/70" />
          </div>
        </div>
        <p v-if="errorOneoff" class="text-red-600 text-sm">{{ errorOneoff }}</p>
        <div class="text-xs text-gray-500">
          送信予定: <code class="font-mono">{{ previewIsoJst }}</code>
        </div>
      </div>

      <!-- DAILY -->
      <div v-else class="space-y-5">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div class="sm:col-span-1">
            <label class="block text-xs font-medium text-gray-600 mb-1">開始日 (JST)</label>
            <input type="date" v-model="dailyStartDate" :min="ymd(new Date())" :max="maxDate"
                   class="w-full rounded-xl border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/70" />
          </div>
          <div class="sm:col-span-1">
            <label class="block text-xs font-medium text-gray-600 mb-1">タイムゾーン</label>
            <select v-model="tz" class="w-full rounded-xl border px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-black/70">
              <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
            </select>
          </div>
          <div class="sm:col-span-1 flex items-end">
            <div class="text-xs text-gray-500">選択中
              <span class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ml-1">
                {{ selectedTimes.size }}/{{ maxDaily }}
              </span>
            </div>
          </div>
        </div>

        <!-- time picker + add -->
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">毎日の送信時刻</label>
          <div class="flex flex-wrap items-center gap-2">
            <input type="time" v-model="dailyTimeInput" step="60"
                   :disabled="!canAddMore"
                   class="w-40 rounded-xl border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/70 disabled:opacity-60" 
                   @keydown.enter.prevent="addDailyTime" />
            <button
              class="rounded-xl px-4 py-2 text-white transition
                     disabled:opacity-60 bg-black hover:bg-black/90"
              :disabled="!canAddMore"
              @click="addDailyTime">
              追加
            </button>
          </div>
          <p v-if="errorDaily" class="text-red-600 text-sm mt-2">{{ errorDaily }}</p>
        </div>

        <!-- chips -->
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-2">選択済み</label>
          <transition-group name="chip" tag="div" class="flex flex-wrap gap-2">
            <span v-for="t in timesSorted" :key="t"
                  class="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-sm bg-white shadow-sm">
              <span class="font-mono">{{ t }}</span>
              <button class="text-gray-500 hover:text-black" @click="removeTime(t)" aria-label="remove">×</button>
            </span>
          </transition-group>
        </div>
      </div>

      <!-- footer -->
      <div class="flex items-center gap-3 pt-2">
        <button
          class="rounded-xl px-5 py-2.5 text-white bg-black hover:bg-black/90 transition disabled:opacity-60"
          :disabled="loading || !authReady"
          @click="onSubmit">
          {{ loading ? '保存中…' : '保存' }}
        </button>
        <span class="text-sm text-gray-600 whitespace-pre-wrap">{{ result }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chip-enter-active, .chip-leave-active { transition: all .15s ease; }
.chip-enter-from { opacity: 0; transform: scale(0.95); }
.chip-leave-to   { opacity: 0; transform: scale(0.95); }
</style>
