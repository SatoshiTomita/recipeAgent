// composables/useScheduleRecipeNotify.ts
import { httpsCallable } from 'firebase/functions'

type SchedulePayload = {
  userId: string
  /** 例: '2025-09-01T19:00:00+09:00' または epoch(ミリ秒) */
  scheduledAt: string | number
}

type ScheduleResult = {
  ok: boolean
  taskName: string
}

/** JST(+09:00) で ISO を作るユーティリティ（必要な人向け） */
function toIsoJst(d: Date): string {
  // 日本は DST なし前提。ローカル時刻のまま +09:00 を付ける簡易版
  const pad = (n: number) => String(n).padStart(2, '0')
  const y = d.getFullYear()
  const m = pad(d.getMonth() + 1)
  const dd = pad(d.getDate())
  const hh = pad(d.getHours())
  const mm = pad(d.getMinutes())
  const ss = pad(d.getSeconds())
  return `${y}-${m}-${dd}T${hh}:${mm}:${ss}+09:00`
}

export const useScheduleRecipeNotify = () => {
  // ★ あなたの既存 composable。region 設定や emulator 接続もここで済んでいる想定
  const functions = useFunctions()

  // 関数名はデプロイ名に合わせてください（ここでは scheduleRecipeNotify）
  const callable = httpsCallable<SchedulePayload, ScheduleResult>(
    functions,
    'api_cloudTasks_schedule-scheduleRecipeNotify'
  )

  /**
   * 予約：Cloud Tasks にジョブを積む
   * @param userId Firebase Auth の uid など
   * @param when Date | ISO(+09:00 推奨) | epoch(ms)
   */
  async function schedule(userId: string, when: Date | string | number) {
    let scheduledAt: string | number = new Date().toISOString();

    if (when instanceof Date) {
      // 明示的に JST へしたい場合は下の toIsoJst を利用
      scheduledAt = toIsoJst(when)
      // もし UTC(Z)で送りたいなら:
      // scheduledAt = when.toISOString()
    }
    const { data } = await callable({ userId, scheduledAt })
    return data // { ok, taskName }
  }

  return { schedule, toIsoJst }
}
