// composables/useScheduleRecipeNotify.ts
import { httpsCallable } from 'firebase/functions'

type SchedulePayload = {
  userId: string
  scheduledAt: string | number
}

type ScheduleResult = { ok: boolean; taskName: string }

export const useScheduleRecipeNotify = () => {
  const functions = useFunctions()
  const callable = httpsCallable<SchedulePayload, ScheduleResult>(
    functions,
    'api_cloudTasks_schedule-scheduleRecipeNotify'
  )

  async function schedule(userId: string, when: Date | string | number) {
    let scheduledAt: string | number

    if (when instanceof Date) {
      // サーバ側で Date.parse するなら ISO(UTC) が安全
      // ※ toIsoJst(when) を使う場合はサーバでそのまま Date.parse 可能
      scheduledAt = when.toISOString()
    } else if (typeof when === 'number') {
      // epoch(ms) をそのまま
      scheduledAt = when
    } else {
      // string(例: '2025-08-24T22:00:00+09:00') をそのまま
      scheduledAt = when
    }

    const { data } = await callable({ userId, scheduledAt })
    return data
  }

  return { schedule }
}
