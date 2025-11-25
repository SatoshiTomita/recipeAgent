import { Timestamp } from 'firebase/firestore'

const DEFAULT_TZ = 'Asia/Tokyo'

export function useDateUtils(defaultTz: string = DEFAULT_TZ) {
  const pad = (n: number) => String(n).padStart(2, '0')

  const ymd = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

  const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

  const toHHmm = (ts: Timestamp, tz: string = defaultTz) =>
    new Intl.DateTimeFormat('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: tz,
    }).format(ts.toDate())

  const toYmdTs = (ts: Timestamp, tz: string = defaultTz) =>
    new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: tz,
    })
      .format(ts.toDate())
      .replace(/\//g, '-')

  const nextOccurrenceFrom = (startYmd: string, hhmmList: string[]): Date => {
    const now = new Date()
    const base = new Date(`${startYmd}T00:00`)
    const sorted = hhmmList
      .map((t) => t.split(':').map(Number) as [number, number])
      .sort(([h1, m1], [h2, m2]) => h1 - h2 || m1 - m2)

    for (let d = 0; d <= 31; d++) {
      const day = new Date(base)
      day.setDate(base.getDate() + d)
      for (const [h, m] of sorted) {
        const cand = new Date(day)
        cand.setHours(h, m, 0, 0)
        if (cand.getTime() > now.getTime()) return cand
      }
    }

    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const [h, m] = sorted[0] ?? [9, 0]
    tomorrow.setHours(h, m, 0, 0)
    return tomorrow
  }

  return { pad, ymd, hm, toHHmm, toYmdTs, nextOccurrenceFrom }
}


