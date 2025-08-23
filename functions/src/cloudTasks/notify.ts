// functions/src/tasks/notify.ts
import { onRequest } from 'firebase-functions/v2/https'
import * as logger from 'firebase-functions/logger'
import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import type { UserInfo, Ingredient, UserPreferences } from '../types/user'

// ★ secrets / core
import { defineSecret } from 'firebase-functions/params'
import { generateAgentRecipeCore, OPENAI_API_KEY } from '../openai/recipes/core'
import type { Prefs, PantryItem } from '../openai/recipes/core'
const LINE_CHANNEL_ACCESS_TOKEN = defineSecret('LINE_CHANNEL_ACCESS_TOKEN')

const REGION = 'asia-northeast1'
const PROJECT_ID = process.env.GCLOUD_PROJECT || 'recipeagent-cff98'
const TASKS_SA = `${PROJECT_ID}@appspot.gserviceaccount.com`

if (getApps().length === 0) initializeApp()

// ---------- Utils ----------
function sanitizeIngredientName(raw: string): string {
  if (!raw) return ''
  let s = raw
  s = s.replace(/^[#＃]?\s*\d+\s*[x×]\s*/i, '')
    .replace(/^[#＃]\s*/, '')
    .replace(/^\d+\s*[x×]\s*/i, '')
    .replace(/(袋|パック|箱)$/u, '')
  const repl: Array<[RegExp, string]> = [
    [/ギョーザ|餃子/gu, '餃子'],
    [/キュウリ|胡瓜/gu, 'きゅうり'],
    [/ジャガイモ|馬鈴薯/gu, 'じゃがいも'],
    [/国産?豚肉.*/gu, '豚肉'],
    [/ユーリンチー/gu, '鶏もも肉'],
    [/マルちゃん.*冷し.*|冷し生ラ|冷やし生ラ/gu, '中華麺'],
    [/バナナ.*?/gu, 'バナナ'],
  ]
  for (const [re, to] of repl) s = s.replace(re, to)
  return s.replace(/\u3000/g, ' ').trim().replace(/\s{2,}/g, ' ')
}
const isMeaningfulName = (s: string) =>
  /[A-Za-z0-9\u3040-\u30FF\u4E00-\u9FFF]/.test(s)

function toStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.map(x => (typeof x === 'string' ? x : (typeof x === 'number' ? String(x) : '')))
    .map(s => s.trim()).filter(Boolean)
}
const toNumber = (v: unknown, def: number) => {
  const n = Number(v); return Number.isFinite(n) ? n : def
}
function toLocaleTag(v: unknown): 'ja-JP' | 'en-US' {
  const s = typeof v === 'string' ? v.toLowerCase() : ''
  return s.startsWith('en') ? 'en-US' : 'ja-JP'
}
function stringToSeed(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0
  return Math.abs(h) || 1
}

// ---------- 正規化 & フォーマット補助 ----------
function coerceNumberLike(x: unknown): number | undefined {
  if (x == null) return undefined
  if (typeof x === 'number' && Number.isFinite(x)) return x
  if (typeof x === 'string') {
    const m = x.replace(/[^\d.]/g, '')
    const n = Number(m)
    return Number.isFinite(n) ? n : undefined
  }
  return undefined
}
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
function pickFirstNumber(obj: any, keys: string[]): number | undefined {
  for (const k of keys) {
    const v = coerceNumberLike(obj?.[k])
    if (v != null) return v
  }
  return undefined
}
function pickFirstString(obj: any, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj?.[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return undefined
}

// ingredients の 1 要素を "名前(数量+単位)" 文字列に
function formatIngredientEntry(entry: any): string {
  if (typeof entry === 'string') return entry
  const name = pickFirstString(entry, ['name', 'ingredient', 'item', 'title']) ?? ''
  const q = pickFirstNumber(entry, ['quantity', 'qty', 'amount', 'count'])
  const unit = pickFirstString(entry, ['unit', 'u'])
  if (!name) return ''
  if (q != null && unit) return `${name}(${q}${unit})`
  if (q != null) return `${name}(${q})`
  return name
}

function normalizeIngredients(arr: any): string[] {
  if (!Array.isArray(arr)) return []
  return arr
    .map(formatIngredientEntry)
    .map(s => s.trim())
    .filter(Boolean)
}

// steps を string[] へ
function normalizeSteps(arr: any): string[] {
  if (!Array.isArray(arr)) return []
  return arr.map((s) => {
    if (typeof s === 'string') return s.trim()
    if (s && typeof s === 'object') {
      return (
        pickFirstString(s, ['text', 'description', 'instruction', 'step', 'content']) ??
        JSON.stringify(s) // 最悪の保険（基本ここには来ない想定）
      ).trim()
    }
    return ''
  }).filter(Boolean)
}

function renderRecipeForLine(recipe: any, prefs: Prefs) {
  const title = (typeof recipe?.title === 'string' && recipe.title.trim())
    ? recipe.title.trim()
    : '本日のレシピ'

  const timeMin =
    coerceNumberLike(recipe?.time) ??
    pickFirstNumber(recipe, ['timeMin', 'totalTimeMin', 'cookTimeMin', 'total_minutes']) ??
    (typeof prefs.maxTimeMin === 'number' ? prefs.maxTimeMin : undefined)

  const budgetYen =
    pickFirstNumber(recipe, ['budgetYen', 'costYen', 'budget', 'cost', 'price']) ??
    (typeof (prefs as any).budgetYen === 'number' ? (prefs as any).budgetYen : undefined)

  const ings = normalizeIngredients(recipe?.ingredients ?? recipe?.pantry ?? [])
  const steps = normalizeSteps(recipe?.steps ?? recipe?.instructions ?? [])

  const head = `🍳 今日のレシピ: ${title}`
  const metaParts: string[] = []
  if (timeMin != null) metaParts.push(`所要時間: 約${Math.round(timeMin)}分`)
  if (budgetYen != null) metaParts.push(`予算: ~¥${Math.round(budgetYen)}`)
  const meta = metaParts.length ? metaParts.join(' / ') : ''

  const ingsLine = ings.length ? `材料: ${ings.join('、')}` : ''
  const stepsBlock = steps.length
    ? `手順:\n${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
    : '手順: 準備中'

  return [head, meta, ingsLine, '', stepsBlock].filter(Boolean).join('\n')
}

// ---------- Main ----------
export const tasksRecipeNotify = onRequest(
  {
    region: REGION,
    invoker: [TASKS_SA],
    secrets: [OPENAI_API_KEY, LINE_CHANNEL_ACCESS_TOKEN],
  },
  async (req, res) => {
    const db = getFirestore()
    let schedRef: FirebaseFirestore.DocumentReference | null = null

    try {
      const { userId, scheduleId, dedupeKey } = req.body as {
        userId?: string; scheduleId?: string; dedupeKey?: string
      }
      if (!userId || !scheduleId) {
        res.status(400).send('userId & scheduleId required'); return
      }

      // 予約ドキュメント
      schedRef = db.doc(`users/${userId}/schedules/${scheduleId}`)
      const schedSnap = await schedRef.get()
      if (!schedSnap.exists) { res.status(404).send('schedule not found'); return }
      const sched = schedSnap.data() as any
      const lineUserId: string | undefined = sched.lineUserId

      if (sched.status === 'SENT') { res.status(200).send('already sent'); return }

      // ユーザー
      const userSnap = await db.doc(`users/${userId}`).get()
      if (!userSnap.exists) { res.status(404).send('user not found'); return }
      const user = userSnap.data() as UserInfo

      // ----- Pantry（PantryItem[] を作る） -----
      const pantry: PantryItem[] = (user.ingredients || [])
        .filter((i: Ingredient) => !!i?.name)
        .map((i): PantryItem | null => {
          const name = sanitizeIngredientName(String(i!.name))
          if (!name || !isMeaningfulName(name)) return null
          const quantity = Math.max(1, Math.round(
            Number.isFinite(Number((i as any).quantity)) ? Number((i as any).quantity) : 1
          ))
          return { name, quantity }
        })
        .filter((x): x is PantryItem => x !== null)

      if (pantry.length === 0) {
        await schedRef.update({
          status: 'FAILED',
          lastError: 'no valid ingredients',
          updatedAt: FieldValue.serverTimestamp(),
        })
        res.status(204).send('no valid ingredients'); return
      }

      if (!lineUserId) {
        await schedRef.update({
          status: 'FAILED',
          lastError: 'lineUserId missing',
          updatedAt: FieldValue.serverTimestamp(),
        })
        res.status(400).send('lineUserId missing'); return
      }

      // ----- Prefs（型を Prefs に合わせる） -----
      const saved = (user.preferences || {}) as UserPreferences & Record<string, unknown>
      const safePrefs: Prefs = {
        ...(typeof saved.cuisine === 'string' && saved.cuisine.trim() ? { cuisine: saved.cuisine } : {}),
        servings: toNumber((saved as any).servings, 2),
        maxTimeMin: toNumber((saved as any).maxTimeMin, 30),
        budgetYen: toNumber((saved as any).budgetYen, 800),
        exclude: toStringArray((saved as any).exclude),
        tools: toStringArray((saved as any).tools),
        locale: toLocaleTag((saved as any).locale),
      }

      // ----- STEP A: レシピ生成（core を直叩き） -----
      logger.info('STEP A: generate recipe start', { pantryCount: pantry.length, prefs: safePrefs })
      const seed = stringToSeed(`${userId}|${scheduleId}`)
      const recipe: any = await generateAgentRecipeCore({ pantry, preferences: safePrefs, seed })
      logger.info('STEP A: generate recipe ok')

      // ----- STEP B: LINE 送信（正規化してから文面作成） -----
      const text = renderRecipeForLine(recipe, safePrefs)

      logger.info('STEP B: line push start')
      const resLine = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN.value()}`,
        },
        body: JSON.stringify({ to: lineUserId, messages: [{ type: 'text', text }] }),
      })
      if (!resLine.ok) {
        const body = await resLine.text()
        throw new Error(`LINE API error: ${resLine.status} ${body}`)
      }
      logger.info('STEP B: line push ok')

      await schedRef.update({
        status: 'SENT',
        sentAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      })
      logger.info('LINE sent', { userId, scheduleId, dedupeKey })
      res.status(200).send('ok')
      try {
        if (sched.ruleId) {
          // ルールを読んで次回分を作成
          const ruleRef = db.doc(`users/${userId}/scheduleRules/${sched.ruleId}`)
          const ruleSnap = await ruleRef.get()
          if (ruleSnap.exists && ruleSnap.data()?.enabled !== false) {
            const rule = ruleSnap.data() as any
            const times: string[] = Array.isArray(rule.times) ? rule.times : []
            if (times.length) {
              // nextDailyIsoJst は onRuleCreated.ts と同じ関数をこのファイルにもコピペするか、共通 util に切り出してください
              const nextIsoJst = nextDailyIsoJst(times)
              const newSchedRef = await db.collection(`users/${userId}/schedules`).add({
                scheduledAt: nextIsoJst,
                lineUserId: rule.lineUserId ?? lineUserId,   // 念のためフォールバック
                status: 'PENDING',
                ruleId: sched.ruleId,
                tz: rule.tz ?? 'Asia/Tokyo',
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
              })
              await ruleRef.update({
                lastEnqueuedAt: FieldValue.serverTimestamp(),
                lastScheduleId: newSchedRef.id,
              })
              logger.info('Auto-enqueued next daily schedule', { userId, ruleId: sched.ruleId, scheduleId: newSchedRef.id, at: nextIsoJst })
            }
          }
        }
      } catch (e) {
        // 次回生成に失敗しても配信自体は成功なので warn ログのみ
        logger.warn('failed to enqueue next daily schedule', { err: (e as any)?.message })
      }
    } catch (e: any) {
      logger.error('notify failed', { err: e?.message, stack: e?.stack })
      try {
        if (schedRef) {
          await schedRef.update({
            status: 'FAILED',
            lastError: String(e?.message ?? 'error'),
            updatedAt: FieldValue.serverTimestamp(),
          })
        }
      } catch { }
      res.status(500).send(e?.message ?? 'error')
    }
  }
)
