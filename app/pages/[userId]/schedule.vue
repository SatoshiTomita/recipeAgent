<!-- components/ScheduleRecipeForm.vue -->
<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { getAuth, onAuthStateChanged, type User } from 'firebase/auth'
import { useScheduleRecipeNotify } from '~/composables/useScheduleRecipeNotify'
import { getFirestore, collection, query, where, orderBy, onSnapshot, Timestamp, doc, updateDoc, serverTimestamp, deleteDoc, getDoc, arrayRemove, setDoc } from 'firebase/firestore'
definePageMeta({ middleware: "auth-client", layout: "with-sidebar", title: 'スケジュール', });
const { createSchedule, createDailyRule } = useScheduleRecipeNotify()
const loading = ref(false)
const result = ref('')

// 固定の LINE ユーザーID
const lineUserId = ref('')
const lineIdError = computed(() => !lineUserId.value ? 'LINEユーザーIDを入力してください' : '')

async function saveLineUserId() {
  const user = await ensureUser()
  if (!user) { result.value = 'ログインが必要です'; return }
  const db = getFirestore()
  await setDoc(
    doc(db, `users/${user.uid}`),
    { lineUserId: lineUserId.value, updatedAt: serverTimestamp() },
    { merge: true }
  )
  result.value = 'LINEユーザーIDを保存しました'
}
// ---- Auth ----
const authReady = ref(false)
const currentUser = ref<User | null>(null)
onMounted(async () => {
  const me = await $fetch<{ lineUserId: string }>('/api/line/me')
  if (me.lineUserId) {
    const auth = getAuth()
    onAuthStateChanged(auth, async (u) => {
      if (!u) return
      const db = getFirestore()
      await updateDoc(doc(db, `users/${u.uid}`), { lineUserId: me.lineUserId })
      // UI 上も反映させたいならローカル状態にもセット
    })
  }
  const unsub = onAuthStateChanged(getAuth(), async (u) => {
    currentUser.value = u
    authReady.value = true
    if (u) {
      // 追加：保存済みの lineUserId をロード
      const db = getFirestore()
      const userRef = doc(db, `users/${u.uid}`)
      const userSnap = await getDoc(userRef)
      lineUserId.value = (userSnap.data()?.lineUserId as string) ?? ''

      watchUpcoming(u.uid)
    }
    unsub()
  })
})
const ensureUser = () => new Promise<User | null>((resolve) => {
  if (currentUser.value) return resolve(currentUser.value)
  const unsub = onAuthStateChanged(getAuth(), (u) => { unsub(); resolve(u) })
})

// 共通
const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
/* ========= 単発 ========= */
const today = new Date()
const dateStr = ref(ymd(today))
const timeStr = ref(hm(today))
const maxDate = computed(() => { const d = new Date(); d.setDate(d.getDate() + 30); return ymd(d) })
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



/* ========= 毎日 ========= */
const dailyStartDate = ref(ymd(today))   // 初回単発生成に使用
const tz = ref('Asia/Tokyo')
const errorDaily = ref<string | null>(null)

const selectedTimes = ref<Set<string>>(new Set())
const maxDaily = 8
const canAddMore = computed(() => selectedTimes.value.size < maxDaily)
const timesSorted = computed(() => Array.from(selectedTimes.value).sort((a, b) => a.localeCompare(b)))

// time入力（Enterでも追加）
const dailyTimeInput = ref('')
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
  selectedTimes.value = new Set(selectedTimes.value) // ★再代入で反応させる
  dailyTimeInput.value = ''
}
function removeTime(t: string) {
  selectedTimes.value.delete(t)
  selectedTimes.value = new Set(selectedTimes.value)
}
function toHHmm(ts: Timestamp, tz: string = 'Asia/Tokyo') {
  return new Intl.DateTimeFormat('ja-JP', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz
  }).format(ts.toDate())
}
function toYmd(ts: Timestamp, tz: string = 'Asia/Tokyo') {
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: tz
  }).format(ts.toDate()).replace(/\//g, '-')
}

// 初回分の最短1件（開始日＋選択時刻）
function nextOccurrenceFrom(startYmd: string, hhmmList: string[]): Date {
  const now = new Date()
  const base = new Date(`${startYmd}T00:00`)
  const sorted = hhmmList
    .map(t => t.split(':').map(Number) as [number, number])
    .sort(([h1, m1], [h2, m2]) => h1 - h2 || m1 - m2)

  for (let d = 0; d <= 31; d++) {
    const day = new Date(base); day.setDate(base.getDate() + d)
    for (const [h, m] of sorted) {
      const cand = new Date(day); cand.setHours(h, m, 0, 0)
      if (cand.getTime() > now.getTime()) return cand
    }
  }
  // fallback: 明日の最初
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const [h, m] = sorted[0] ?? [9, 0]
  tomorrow.setHours(h, m, 0, 0)
  return tomorrow
}
const upcomingUnique = computed(() => {
  const map = new Map<string, (ScheduleItem & { hhmm: string, nextYmd: string })>()
  for (const it of upcoming.value) {
    const tz = it.tz ?? 'Asia/Tokyo'
    const hhmm = toHHmm(it.scheduledAtTs, tz) // ← キー
    if (!map.has(hhmm)) {
      map.set(hhmm, { ...it, hhmm, nextYmd: toYmd(it.scheduledAtTs, tz) })
    }
  }
  // 表示順は時刻順
  return Array.from(map.values()).sort((a, b) => a.hhmm.localeCompare(b.hhmm))
})

type ScheduleItem = {
  id: string
  scheduledAtTs: Timestamp
  scheduledAt?: string
  ruleId?: string
  tz?: string
}

const upcoming = ref<ScheduleItem[]>([])
let stopUpcoming: null | (() => void) = null
function watchUpcoming(userId: string) {
  const db = getFirestore()
  const qRef = query(
    collection(db, `users/${userId}/schedules`),
    where('scheduledAtTs', '>=', Timestamp.fromDate(new Date())),
    orderBy('scheduledAtTs', 'asc'),
  )
  stopUpcoming = onSnapshot(qRef, snap => {
    const rows: ScheduleItem[] = []
    snap.forEach(d => {
      const data = d.data() as any
      let ts: Timestamp | null = null
      if (data?.scheduledAtTs instanceof Timestamp) ts = data.scheduledAtTs
      else if (data?.scheduledAt instanceof Timestamp) ts = data.scheduledAt
      else if (typeof data?.scheduledAt === 'string') {
        const ms = Date.parse(data.scheduledAt)
        if (Number.isFinite(ms)) ts = Timestamp.fromDate(new Date(ms))
      }
      if (ts) {
        rows.push({
          id: d.id,
          scheduledAtTs: ts,
          scheduledAt: data.scheduledAt,
          ruleId: data.ruleId,
          tz: data.tz
        })
      }
    })
    upcoming.value = rows
  })
  return stopUpcoming
}
const { $liffInit } = useNuxtApp()
const liffId = useRuntimeConfig().public.liffId as string

const goLineLogin = async () => {
  try {
    if (!liffId) throw new Error('LIFF ID が設定されていません')
    const userId=useRoute().params.userId as string;
    const profile = await $liffInit(liffId, userId)
    if (!profile) return
    lineUserId.value = profile.userId
    await saveLineUserId()
    result.value = 'LINE アカウントを連携しました'
  } catch (e: any) {
    console.error(e)
    result.value = `LINE 連携に失敗しました: ${e?.message ?? e}`
  }
}
onUnmounted(() => { if (stopUpcoming) stopUpcoming() })
async function cancelScheduleForItem(item: ScheduleItem & { hhmm?: string }) {
  if (!currentUser.value) return
  const db = getFirestore()
  const uid = currentUser.value.uid

  // 1) schedules/{id} を削除
  const schedRef = doc(db, `users/${uid}/schedules/${item.id}`)
  const snap = await getDoc(schedRef)
  const data = snap.data() as any || {}
  const tz = data?.tz || item.tz || 'Asia/Tokyo'
  const hhmm = item.hhmm ?? toHHmm(item.scheduledAtTs, tz)
  const ruleId = data?.ruleId ?? item.ruleId

  await deleteDoc(schedRef)

  // 2) もし daily 由来なら、rules からも HH:mm を抜く
  if (ruleId) {
    const ruleRef = doc(db, `users/${uid}/scheduleRules/${ruleId}`)
    await updateDoc(ruleRef, {
      times: arrayRemove(hhmm),
      updatedAt: serverTimestamp(),
    } as any)
  }
}
/* ========= 送信 ========= */
async function onSubmit() {
  loading.value = true
  result.value = ''
  try {
    const user = await ensureUser()
    if (!user) throw new Error('ログインが必要です')
    if (!lineUserId.value) throw new Error('LINEユーザーIDを入力してください')

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
      <p class="text-sm text-gray-500">LINEを送信される日時を設定してください。</p>
    </div>
    <!-- Card -->
    <div class="rounded-2xl border bg-white/70 backdrop-blur p-5 shadow-sm space-y-6">
      <!-- DAILY -->
      <div class="space-y-5">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div class="sm:col-span-1">
            <label class="block text-xs font-medium text-gray-600 mb-1">開始日 (JST)</label>
            <input type="date" v-model="dailyStartDate" :min="ymd(new Date())" :max="maxDate"
              class="w-full rounded-xl border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/70" />
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
            <input type="time" v-model="dailyTimeInput" step="60" :disabled="!canAddMore"
              class="w-40 rounded-xl border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/70 disabled:opacity-60"
              @keydown.enter.prevent="addDailyTime" />
            <button class="rounded-xl px-4 py-2 text-white transition
                     disabled:opacity-60 bg-black hover:bg-black/90" :disabled="!canAddMore" @click="addDailyTime">
              追加
            </button>
          </div>
          <p v-if="errorDaily" class="text-red-600 text-sm mt-2">{{ errorDaily }}</p>
        </div>
        <div class="  backdrop-blur mb-6">
          <label class="block text-xs font-medium text-gray-600 mb-1">LINE ユーザーID</label>
          <div class="flex gap-2">
            <input v-model.trim="lineUserId" type="text"
              class="flex-1 rounded-xl border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/70"
              placeholder="例) Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
            <button class="rounded-xl px-4 py-2 text-white bg-black hover:bg-black/90 transition disabled:opacity-60"
              :disabled="!authReady || !lineUserId" @click="saveLineUserId">
              保存
            </button>
          </div>
          <p v-if="lineIdError" class="text-red-600 text-sm mt-2">{{ lineIdError }}</p>
          <p v-else class="text-xs text-gray-500 mt-2">※ LINE Official Account Manager などで取得した userId を入力してください。</p>
        </div>
        <button class="rounded-lg px-3 py-2 bg-[#06C755] text-white"
          @click="goLineLogin">
          LINE と連携
        </button>


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
      <div class="pt-4">
        <h3 class="text-sm font-medium text-gray-700 mb-2">送信予定</h3>

        <div v-if="!upcomingUnique.length" class="text-sm text-gray-500">
          スケジュールは設定されていません
        </div>

        <ul v-else class="space-y-2">
          <li v-for="item in upcomingUnique" :key="item.hhmm"
            class="flex items-center justify-between rounded-xl border bg-white px-3 py-2">
            <div class="text-sm">
              <div class="font-mono text-base">{{ (item as any).hhmm }}</div>
              <div class="text-xs text-gray-500">次回: {{ (item as any).nextYmd }}</div>
              <div v-if="item.ruleId" class="text-xs text-gray-500">rule: {{ item.ruleId }}</div>
            </div>
            <div class="flex items-center gap-2">
              <button class="rounded-lg px-3 py-1.5 text-white bg-red-600 hover:bg-red-500"
                @click="cancelScheduleForItem(item as any)">
                取り消し
              </button>
              <!-- 任意: 今すぐ送信 -->
              <!-- <button class="rounded-lg px-3 py-1.5 border hover:bg-gray-50"
                @click="runNow(item.id)">
          今すぐ送信
        </button> -->
            </div>
          </li>
        </ul>
      </div>
      <!-- footer -->
      <div class="flex items-center gap-3 pt-2">
        <button class="rounded-xl px-5 py-2.5 text-white bg-black hover:bg-black/90 transition disabled:opacity-60"
          :disabled="loading || !authReady" @click="onSubmit">
          {{ loading ? '保存中…' : '保存' }}
        </button>
        <span class="text-sm text-gray-600 whitespace-pre-wrap">{{ result }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chip-enter-active,
.chip-leave-active {
  transition: all .15s ease;
}

.chip-enter-from {
  opacity: 0;
  transform: scale(0.95);
}

.chip-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
