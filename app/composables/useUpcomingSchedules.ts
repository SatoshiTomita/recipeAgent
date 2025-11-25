import { ref, computed } from 'vue'
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore'
import { useDateUtils } from './useDateUtils'

export type ScheduleItem = {
  id: string
  scheduledAtTs: Timestamp
  scheduledAt?: string
  ruleId?: string
  tz?: string
}

export function useUpcomingSchedules(defaultTz: string = 'Asia/Tokyo') {
  const upcoming = ref<ScheduleItem[]>([])
  const { toHHmm, toYmdTs } = useDateUtils(defaultTz)
  const upcomingUnique = computed(() => {
    const map = new Map<string, (ScheduleItem & { hhmm: string; nextYmd: string })>()
    for (const it of upcoming.value) {
      const tzVal = it.tz ?? defaultTz
      const hhmm = toHHmm(it.scheduledAtTs, tzVal)
      if (!map.has(hhmm)) {
        map.set(hhmm, { ...it, hhmm, nextYmd: toYmdTs(it.scheduledAtTs, tzVal) })
      }
    }
    return Array.from(map.values()).sort((a, b) => a.hhmm.localeCompare(b.hhmm))
  })

  let stop: null | (() => void) = null
  const watchUpcoming = (userId: string) => {
    const db = getFirestore()
    const qRef = query(
      collection(db, `users/${userId}/schedules`),
      where('scheduledAtTs', '>=', Timestamp.fromDate(new Date())),
      orderBy('scheduledAtTs', 'asc'),
    )
    stop = onSnapshot(qRef, (snap) => {
      const rows: ScheduleItem[] = []
      snap.forEach((d) => {
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
            tz: data.tz,
          })
        }
      })
      upcoming.value = rows
    })
    return stop
  }

  const stopUpcoming = () => { if (stop) { stop(); stop = null } }

  return { upcoming, upcomingUnique, watchUpcoming, stopUpcoming }
}


