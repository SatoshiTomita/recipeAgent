// composables/useScheduleRecipeNotify.ts
import { getFirestore, collection, addDoc, Timestamp, serverTimestamp } from 'firebase/firestore'

type CreateScheduleInput = {
  userId: string
  when: Date | string | number
  lineUserId: string
}
type CreateScheduleResult = { scheduleId: string }

type CreateDailyRuleInput = {
  userId: string
  lineUserId: string
  times: string[]     // 'HH:mm'
  tz?: string         // default: 'Asia/Tokyo'
}
type CreateDailyRuleResult = { ruleId: string }

// ---- helpers ----
function toTimestamp(when: Date | string | number): Timestamp {
  if (when instanceof Date) return Timestamp.fromDate(when)
  if (typeof when === 'number') {
    const ms = when > 10_000_000_000 ? when : when * 1000
    return Timestamp.fromMillis(ms)
  }
  const ms = Date.parse(when)
  if (!Number.isFinite(ms)) throw new Error('scheduledAt is invalid string')
  return Timestamp.fromMillis(ms)
}
function normTime(t: string): string | null {
  const m = t.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const h = Math.max(0, Math.min(23, parseInt(m[1], 10)))
  const mm = Math.max(0, Math.min(59, parseInt(m[2], 10)))
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

export const useScheduleRecipeNotify = () => {
  const db = getFirestore()

  // 単発予約：ルールで許可されているキーだけをセット
  async function createSchedule(
    { userId, when, lineUserId }: CreateScheduleInput
  ): Promise<CreateScheduleResult> {
    const col = collection(db, `users/${userId}/schedules`)
    const scheduledAt = toTimestamp(when)
    const now = serverTimestamp()
    const docRef = await addDoc(col, {
      scheduledAt,
      lineUserId,
      createdAt: now,   // ★ 追加
      updatedAt: now,   // ★ 追加
    })
    return { scheduleId: docRef.id }
  }

  // 毎日ルール：こちらも createdAt / updatedAt を必ず入れる
  async function createDailyRule(
    { userId, lineUserId, times, tz = 'Asia/Tokyo' }: CreateDailyRuleInput
  ): Promise<CreateDailyRuleResult> {
    const cleaned = Array.from(new Set(times.map(normTime).filter(Boolean) as string[]))
    if (cleaned.length === 0) throw new Error('時刻を1つ以上入れてください（HH:mm）')
    if (cleaned.length > 8) cleaned.splice(8)

    const now = serverTimestamp()
    const ref = await addDoc(collection(db, `users/${userId}/scheduleRules`), {
      type: 'DAILY',
      times: cleaned,
      tz,
      lineUserId,
      enabled: true,
      createdAt: now,   // ★ 追加
      updatedAt: now,   // ★ 追加
    })
    return { ruleId: ref.id }
  }

  return { createSchedule, createDailyRule }
}
