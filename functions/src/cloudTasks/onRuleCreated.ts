// functions/src/schedules/onRuleCreated.ts
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { initializeApp, getApps } from 'firebase-admin/app'
import * as logger from 'firebase-functions/logger'

if (getApps().length === 0) initializeApp()

const LOCATION = 'asia-northeast1'

function nextDailyIsoJst(times: string[], nowMs = Date.now()): string {
  // JST (+09:00)の「いま」と当日を作る
  const nowJst = new Date(nowMs + 9 * 3600_000)
  const Y = nowJst.getUTCFullYear()
  const M = nowJst.getUTCMonth() + 1
  const D = nowJst.getUTCDate()

  const pad = (n: number) => String(n).padStart(2, '0')
  const isoOf = (y: number, m: number, d: number, h: number, min: number) =>
    `${y}-${pad(m)}-${pad(d)}T${pad(h)}:${pad(min)}:00+09:00`

  const toMs = (iso: string) => Date.parse(iso)

  // 今日候補
  const candsToday: number[] = []
  for (const t of times) {
    const [hh, mm] = t.split(':').map(Number)
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) continue
    candsToday.push(toMs(isoOf(Y, M, D, hh, mm)))
  }
  const nowJstMs = nowMs + 9 * 3600_000
  const futureToday = candsToday.filter(ms => ms > nowJstMs).sort((a, b) => a - b)
  if (futureToday.length) return new Date(futureToday[0]).toISOString().replace('Z', '+09:00')

  // 明日の最初
  const first = times
    .map(t => t.split(':').map(Number))
    .filter(([h, m]) => Number.isFinite(h) && Number.isFinite(m))
    .sort(([h1, m1], [h2, m2]) => h1 - h2 || m1 - m2)[0]
  const base = new Date(nowJst)
  base.setUTCDate(D + 1)
  const iso = isoOf(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), first?.[0] ?? 9, first?.[1] ?? 0)
  return iso
}

async function ensureNextOccurrence(userId: string, ruleId: string) {
  const db = getFirestore()
  const ruleRef = db.doc(`users/${userId}/scheduleRules/${ruleId}`)
  const ruleSnap = await ruleRef.get()
  if (!ruleSnap.exists) return
  const rule = ruleSnap.data() as any
  if (rule.enabled === false) return

  const times: string[] = Array.isArray(rule.times) ? rule.times : []
  if (times.length === 0) return

  const nextIsoJst = nextDailyIsoJst(times)     // "YYYY-MM-DDTHH:mm:00+09:00"
  const when = new Date(nextIsoJst)             // ← これを Timestamp として保存
  
  const schedRef = await db.collection(`users/${userId}/schedules`).add({
    scheduledAt: nextIsoJst,        // 文字列（見やすさ用）
    scheduledAtTs: when,            // ← Timestamp（Admin SDKはDateをTimestampで保存）
    lineUserId: rule.lineUserId,
    status: 'PENDING',
    ruleId,
    tz: rule.tz ?? 'Asia/Tokyo',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })

  await ruleRef.update({
    lastEnqueuedAt: FieldValue.serverTimestamp(),
    lastScheduleId: schedRef.id,
  })

  logger.info('Enqueued next daily schedule', { userId, ruleId, scheduleId: schedRef.id, at: nextIsoJst })
}

// 作成時
export const onRuleCreated = onDocumentCreated(
  { region: LOCATION, document: 'users/{userId}/scheduleRules/{ruleId}' },
  async (e) => {
    const { userId, ruleId } = e.params
    await ensureNextOccurrence(userId, ruleId)
  }
)

// （任意）更新時に enabled=true になった/ times 変えたら再計算
export const onRuleUpdated = onDocumentUpdated(
  { region: LOCATION, document: 'users/{userId}/scheduleRules/{ruleId}' },
  async (e) => {
    const before = e.data?.before?.data() as any
    const after  = e.data?.after?.data() as any
    if (!after) return
    const { userId, ruleId } = e.params

    const enabledChanged = before?.enabled !== after?.enabled
    const timesChanged   = JSON.stringify(before?.times ?? []) !== JSON.stringify(after?.times ?? [])
    if ((enabledChanged && after.enabled) || timesChanged) {
      await ensureNextOccurrence(userId, ruleId)
    }
  }
)
