<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { useScheduleRecipeNotify } from '~/composables/useScheduleRecipeNotify'
import { getLiffIdByEventId } from '~/composables/useLiff'
import { useAuthUser } from '~/composables/useAuthUser'
import { useDateUtils } from '~/composables/useDateUtils'
import { useUpcomingSchedules } from '~/composables/useUpcomingSchedules'
import {
  getFirestore,
  onSnapshot,
  Timestamp,
  doc,
  updateDoc,
  serverTimestamp,
  deleteDoc,
  getDoc,
  arrayRemove,
  setDoc
} from 'firebase/firestore'

definePageMeta({ middleware: "auth-client", layout: "with-sidebar", title: 'スケジュール', });

const MAX_DAILY = 8
const DEFAULT_TZ = 'Asia/Tokyo'

type ScheduleItem = {
  id: string
  scheduledAtTs: Timestamp
  scheduledAt?: string
  ruleId?: string
  tz?: string
}

const { createSchedule, createDailyRule } = useScheduleRecipeNotify()
const loading = ref(false)
const result = ref('')
const lineUserId = ref('')
const lineIdError = computed(() => !lineUserId.value ? 'LINEユーザーIDを入力してください' : '')
const displayName = ref<string>('')
const pictureUrl = ref<string>('')
let stopUserDoc: null | (() => void) = null
let stopUpcoming: null | (() => void) = null

const saveLineUserId = async () => {
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
const { authReady, currentUser, ensureUser } = useAuthUser()

// 共通
const { pad, ymd, hm, toHHmm, nextOccurrenceFrom } = useDateUtils(DEFAULT_TZ)

/* ========= 単発 ========= */
const today = new Date()
const dateStr = ref(ymd(today))
const timeStr = ref(hm(today))
const maxDate = computed(() => { const d = new Date(); d.setDate(d.getDate() + 30); return ymd(d) })
const errorOneoff = ref<string | null>(null)



/* ========= 毎日 ========= */
const dailyStartDate = ref(ymd(today))
const tz = ref(DEFAULT_TZ)
const errorDaily = ref<string | null>(null)

const selectedTimes = ref<Set<string>>(new Set())
const canAddMore = computed(() => selectedTimes.value.size < MAX_DAILY)
const timesSorted = computed(() => Array.from(selectedTimes.value).sort((a, b) => a.localeCompare(b)))

const dailyTimeInput = ref('')

const addDailyTime = () => {
  errorDaily.value = null
  const m = dailyTimeInput.value?.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) { errorDaily.value = 'HH:mm 形式で入力してください'; return }
  const h = Math.max(0, Math.min(23, parseInt(m[1]!, 10)))
  const mm = Math.max(0, Math.min(59, parseInt(m[2]!, 10)))
  const t = `${pad(h)}:${pad(mm)}`
  if (selectedTimes.value.has(t)) { errorDaily.value = `${t} は追加済みです`; return }
  if (!canAddMore.value) { errorDaily.value = `最大 ${MAX_DAILY} 件までです`; return }
  selectedTimes.value.add(t)
  selectedTimes.value = new Set(selectedTimes.value)
  dailyTimeInput.value = ''
}

const removeTime = (t: string) => {
  selectedTimes.value.delete(t)
  selectedTimes.value = new Set(selectedTimes.value)
}

const {  upcomingUnique, watchUpcoming } = useUpcomingSchedules(DEFAULT_TZ)

const route = useRoute()
const router = useRouter()

const goLineLogin = async () => {
  try {
    const user = await ensureUser()
    if (!user) throw new Error('ログインが必要です')
    const userId = route.params.userId as string
    if (!userId) throw new Error('URL に userId がありません')
    const liffId = await getLiffIdByEventId(userId)
    const ctx = { userId, next: '/:uid/schedule', liffId, destUid: user.uid }
    const ctxStr = JSON.stringify(ctx)
    try { sessionStorage.setItem('liff_context', ctxStr) } catch { }
    try { sessionStorage.setItem('dest_uid', user.uid) } catch { }
    const ctxB64 = btoa(encodeURIComponent(ctxStr))
    router.push({ path: '/liffEntry', query: { ctx: ctxB64 } })
  } catch (e: any) {
    console.error(e)
    result.value = `LINE 連携に失敗しました: ${e?.message ?? e}`
  }
}


const cancelScheduleForItem = async (item: ScheduleItem & { hhmm?: string }) => {
  if (!currentUser.value) return
  const db = getFirestore()
  const uid = currentUser.value.uid

  const schedRef = doc(db, `users/${uid}/schedules/${item.id}`)
  const snap = await getDoc(schedRef)
  const data = snap.data() as any || {}
  const tzVal = data?.tz || item.tz || DEFAULT_TZ
  const hhmm = item.hhmm ?? toHHmm(item.scheduledAtTs, tzVal)
  const ruleId = data?.ruleId ?? item.ruleId

  await deleteDoc(schedRef)

  if (ruleId) {
    const ruleRef = doc(db, `users/${uid}/scheduleRules/${ruleId}`)
    await updateDoc(ruleRef, {
      times: arrayRemove(hhmm),
      updatedAt: serverTimestamp(),
    } as any)
  }
}

const onSubmit = async () => {
  loading.value = true
  result.value = ''
  try {
    const user = await ensureUser()
    if (!user) throw new Error('ログインが必要です')
    if (!lineUserId.value) throw new Error('LINEユーザーIDを入力してください')

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dailyStartDate.value)) throw new Error('開始日が不正です')
    if (!selectedTimes.value.size) throw new Error('時刻を1つ以上追加してください')
    if (selectedTimes.value.size > MAX_DAILY) throw new Error(`1日あたり最大 ${MAX_DAILY} 件までです`)
    const cleaned = timesSorted.value

    const { ruleId } = await createDailyRule({
      userId: user.uid,
      lineUserId: lineUserId.value,
      times: cleaned,
      tz: tz.value,
    })

    const firstWhen = nextOccurrenceFrom(dailyStartDate.value, cleaned)
    const { scheduleId } = await createSchedule({
      userId: user.uid,
      when: firstWhen,
      lineUserId: lineUserId.value
    })
    result.value = `毎日ルールを作成: ${ruleId}\n初回分の予約を作成: ${scheduleId}`
  } catch (e: any) {
    result.value = `エラー: ${e?.message ?? e}`
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  const me = await $fetch<{ lineUserId: string }>('/api/line/me')
  const unsub = onAuthStateChanged(getAuth(), async (u) => {
    currentUser.value = u
    authReady.value = true

    // 既存のユーザーdoc監視を止める
    if (stopUserDoc) { stopUserDoc(); stopUserDoc = null }

    if (u) {
      const db = getFirestore()

      if (me.lineUserId) {
        await updateDoc(doc(db, `users/${u.uid}`), { lineUserId: me.lineUserId })
      }

      const userRef = doc(db, `users/${u.uid}`)
      stopUserDoc = onSnapshot(userRef, (snap) => {
        const data = snap.data() as any || {}
        lineUserId.value = data?.lineUserId ?? ''
        displayName.value = data?.lineProfile.displayName ?? data?.lineDisplayName ?? ''
        pictureUrl.value = data?.lineProfile.pictureUrl ?? data?.linePictureUrl ?? ''
      })
      if (!stopUpcoming) {
        stopUpcoming = watchUpcoming(u.uid)
      }
    }
    unsub()
  })
})
onUnmounted(() => { if (stopUpcoming) stopUpcoming(); })
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
                {{ selectedTimes.size }}/{{ MAX_DAILY }}
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
        <button class="rounded-lg px-3 py-2 bg-[#06C755] text-white flex items-center gap-2" @click="goLineLogin">
          <svg xmlns="http://www.w3.org/2000/svg" class="size-6" viewBox="0 0 48 48">
            <path fill="#00c300"
              d="M12.5,42h23c3.59,0,6.5-2.91,6.5-6.5v-23C42,8.91,39.09,6,35.5,6h-23C8.91,6,6,8.91,6,12.5v23C6,39.09,8.91,42,12.5,42z">
            </path>
            <path fill="#fff"
              d="M37.113,22.417c0-5.865-5.88-10.637-13.107-10.637s-13.108,4.772-13.108,10.637c0,5.258,4.663,9.662,10.962,10.495c0.427,0.092,1.008,0.282,1.155,0.646c0.132,0.331,0.086,0.85,0.042,1.185c0,0-0.153,0.925-0.187,1.122c-0.057,0.331-0.263,1.296,1.135,0.707c1.399-0.589,7.548-4.445,10.298-7.611h-0.001C36.203,26.879,37.113,24.764,37.113,22.417z M18.875,25.907h-2.604c-0.379,0-0.687-0.308-0.687-0.688V20.01c0-0.379,0.308-0.687,0.687-0.687c0.379,0,0.687,0.308,0.687,0.687v4.521h1.917c0.379,0,0.687,0.308,0.687,0.687C19.562,25.598,19.254,25.907,18.875,25.907z M21.568,25.219c0,0.379-0.308,0.688-0.687,0.688s-0.687-0.308-0.687-0.688V20.01c0-0.379,0.308-0.687,0.687-0.687s0.687,0.308,0.687,0.687V25.219z M27.838,25.219c0,0.297-0.188,0.559-0.47,0.652c-0.071,0.024-0.145,0.036-0.218,0.036c-0.215,0-0.42-0.103-0.549-0.275l-2.669-3.635v3.222c0,0.379-0.308,0.688-0.688,0.688c-0.379,0-0.688-0.308-0.688-0.688V20.01c0-0.296,0.189-0.558,0.47-0.652c0.071-0.024,0.144-0.035,0.218-0.035c0.214,0,0.42,0.103,0.549,0.275l2.67,3.635V20.01c0-0.379,0.309-0.687,0.688-0.687c0.379,0,0.687,0.308,0.687,0.687V25.219z M32.052,21.927c0.379,0,0.688,0.308,0.688,0.688c0,0.379-0.308,0.687-0.688,0.687h-1.917v1.23h1.917c0.379,0,0.688,0.308,0.688,0.687c0,0.379-0.309,0.688-0.688,0.688h-2.604c-0.378,0-0.687-0.308-0.687-0.688v-2.603c0-0.001,0-0.001,0-0.001c0,0,0-0.001,0-0.001v-2.601c0-0.001,0-0.001,0-0.002c0-0.379,0.308-0.687,0.687-0.687h2.604c0.379,0,0.688,0.308,0.688,0.687s-0.308,0.687-0.688,0.687h-1.917v1.23H32.052z">
            </path>
          </svg>
          <span class="leading-none">LINE と連携</span>
        </button>

        <div class="flex flex-col">
          <span>連携済みアカウント：</span>
          <div v-if="displayName || pictureUrl" class="flex items-center gap-3 mt-3">
            <img v-if="pictureUrl" :src="pictureUrl" alt="Profile" class="w-10 h-10 rounded-full border" />
            <span v-if="displayName" class="text-sm font-medium text-gray-800">{{ displayName }}</span>
          </div>
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
