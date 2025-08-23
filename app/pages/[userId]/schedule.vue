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

// ==== 単発：カレンダー(date)＋時刻(time) ====
const tzLabel = '(JST +09:00)'
const today = new Date()
const dateStr = ref(ymd(today))
const timeStr = ref(hm(today))
const maxDate = computed(() => {
  const d = new Date(); d.setDate(d.getDate() + 30); return ymd(d)
})
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
function setIn(minutes: number) { const d = new Date(Date.now() + minutes*60_000); dateStr.value = ymd(d); timeStr.value = hm(d) }
function setTonight() { const d = new Date(); d.setHours(20,0,0,0); if (d<=new Date()) d.setDate(d.getDate()+1); dateStr.value = ymd(d); timeStr.value = hm(d) }
function setTomorrow() { const d = new Date(); d.setDate(d.getDate()+1); d.setHours(7,0,0,0); dateStr.value = ymd(d); timeStr.value = hm(d) }

// ==== 毎日：開始日（カレンダー）＋時刻群 ====
const dailyStartDate = ref(ymd(today))   // カレンダーUI
const times = ref<string[]>(['07:30'])
const tz = ref('Asia/Tokyo')
const errorDaily = ref<string | null>(null)

function addTime() { times.value.push('20:00') }
function removeTime(i: number) { times.value.splice(i, 1) }
function validateDaily(): string[] | null {
  errorDaily.value = null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dailyStartDate.value)) { errorDaily.value = '開始日が不正です'; return null }
  const set = new Set<string>()
  for (const t of times.value) {
    const m = t.trim().match(/^(\d{1,2}):(\d{2})$/)
    if (!m) { errorDaily.value = '時刻は HH:mm 形式で入力してください'; return null }
    const hh = Math.max(0, Math.min(23, parseInt(m[1],10)))
    const mm = Math.max(0, Math.min(59, parseInt(m[2],10)))
    set.add(`${pad(hh)}:${pad(mm)}`)
  }
  if (set.size === 0) { errorDaily.value = '時刻を1つ以上入れてください'; return null }
  return Array.from(set).slice(0, 8)
}

// 初回分の単発日時を（開始日＋時刻群）から計算
function nextOccurrenceFrom(startYmd: string, hhmmList: string[]): Date {
  const now = new Date()
  const base = new Date(`${startYmd}T00:00`)
  const sorted = hhmmList
    .map(t => t.split(':').map(Number) as [number, number])
    .sort(([h1,m1], [h2,m2]) => h1 - h2 || m1 - m2)

  for (let d = 0; d <= 31; d++) {
    const day = new Date(base)
    day.setDate(base.getDate() + d)
    for (const [h, m] of sorted) {
      const cand = new Date(day)
      cand.setHours(h, m, 0, 0)
      if (cand.getTime() > now.getTime()) return cand
    }
  }
  // フォールバック：明日の最初の時刻
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate()+1)
  const [h, m] = sorted[0] ?? [9, 0]
  tomorrow.setHours(h, m, 0, 0)
  return tomorrow
}

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
      const cleaned = validateDaily(); if (!cleaned) throw new Error(errorDaily.value || '時刻エラー')
      // 1) ルール作成（最小キーのみ）
      const { ruleId } = await createDailyRule({
        userId: user.uid,
        lineUserId: lineUserId.value,
        times: cleaned,
        tz: tz.value,
      })
      // 2) 初回分はフロントで単発予約を1件作成（rulesと相性◎）
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
  <div class="space-y-5">
    <div class="flex gap-3 items-center">
      <label class="font-medium">送信タイプ:</label>
      <label class="flex items-center gap-1"><input type="radio" value="oneoff" v-model="mode"> 単発</label>
      <label class="flex items-center gap-1"><input type="radio" value="daily" v-model="mode"> 毎日</label>
    </div>

    <!-- 単発：カレンダー＋時刻 -->
    <div v-if="mode==='oneoff'" class="space-y-3">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="block text-sm font-medium">日付 <span class="text-gray-500">(JST)</span></label>
          <input class="border rounded px-3 py-2 w-full" type="date" v-model="dateStr" :min="ymd(new Date())" :max="maxDate" />
        </div>
        <div>
          <label class="block text-sm font-medium">時刻</label>
          <input class="border rounded px-3 py-2 w-full" type="time" v-model="timeStr" step="60" />
        </div>
      </div>
      <p v-if="errorOneoff" class="text-red-600 text-sm">{{ errorOneoff }}</p>
      <p class="text-xs text-gray-500">プレビュー（+09:00）: <code>{{ previewIsoJst }}</code></p>

      <div class="flex flex-wrap gap-2">
        <button class="px-3 py-1.5 border rounded" @click="setIn(10)">+10分</button>
        <button class="px-3 py-1.5 border rounded" @click="setIn(60)">+1時間</button>
        <button class="px-3 py-1.5 border rounded" @click="setTonight()">今夜20:00</button>
        <button class="px-3 py-1.5 border rounded" @click="setTomorrow()">明朝7:00</button>
      </div>
    </div>

    <!-- 毎日：開始日（カレンダー）＋時刻群 -->
    <div v-else class="space-y-3">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="block text-sm font-medium">開始日 <span class="text-gray-500">(JST)</span></label>
          <input class="border rounded px-3 py-2 w-full" type="date" v-model="dailyStartDate" :min="ymd(new Date())" :max="maxDate" />
        </div>
        <div class="flex items-end gap-2">
          <div class="grow">
            <label class="block text-sm font-medium">タイムゾーン</label>
            <select class="border rounded px-2 py-1 w-full" v-model="tz">
              <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
            </select>
          </div>
        </div>
      </div>

      <div class="space-y-2">
        <label class="block text-sm font-medium">毎日の送信時刻（複数可, HH:mm）</label>
        <div v-for="(t,i) in times" :key="i" class="flex items-center gap-2">
          <input class="border rounded px-3 py-1 w-32" v-model="times[i]" placeholder="07:30" />
          <button class="px-2 py-1 border rounded" @click="removeTime(i)" :disabled="times.length<=1">削除</button>
        </div>
        <button class="px-3 py-1.5 border rounded" @click="addTime">＋追加</button>
        <p v-if="errorDaily" class="text-red-600 text-sm">{{ errorDaily }}</p>
      </div>
    </div>

    <div class="space-y-1">
      <p class="text-sm">LINEユーザーID: <code>{{ lineUserId }}</code>（固定）</p>
    </div>

    <div class="flex items-center gap-3">
      <button class="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
              :disabled="loading || !authReady"
              @click="onSubmit">
        {{ loading ? '送信中…' : '保存' }}
      </button>
      <span class="text-sm text-gray-600 whitespace-pre-wrap">{{ result }}</span>
    </div>
  </div>
</template>
