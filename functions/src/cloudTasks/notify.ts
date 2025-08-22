// functions/src/tasks/notify.ts
import { onRequest } from 'firebase-functions/v2/https'
import * as logger from 'firebase-functions/logger'

// ★ Admin SDK を使用（ブラウザSDKは使わない）
import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

import type { UserInfo, Ingredient, UserPreferences } from '../types/user'
import { GoogleAuth } from 'google-auth-library'

const REGION = 'asia-northeast1'
const PROJECT_ID = 'recipeagent-cff98'
const TASKS_SA = `${PROJECT_ID}@appspot.gserviceaccount.com`

const GENERATE_RECIPE_URL =
  'https://api-openai-recipes-generaeteagentrecipes-generate-inljxzbgdq-an.a.run.app'
const LINE_PUSH_URL =
  'https://api-messaging-linepush-linebroadcast-inljxzbgdq-an.a.run.app'

// Admin SDK 初期化（多重初期化防止）
if (getApps().length === 0) initializeApp()

type GeneratedRecipe = {
  title: string
  time: number
  budget: number
  ingredients: { name: string; quantity?: number }[]
  steps: string[]
}

// OIDC 付き HTTP POST
async function postWithOidc<T>(url: string, json: unknown): Promise<T> {
  const auth = new GoogleAuth()
  const client = await auth.getIdTokenClient(url)
  const res = await client.request<T>({
    url,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    data: json,
  })
  return res.data
}

export const tasksRecipeNotify = onRequest(
  { region: REGION, invoker: [TASKS_SA] },
  async (req, res): Promise<void> => {
    try {
      const { userId, dedupeKey } = req.body as { userId?: string; dedupeKey?: string }
      if (!userId) { res.status(400).send('userId is required'); return }

      const db = getFirestore()

      // ★ Admin SDK 流儀で取得
      const snap = await db.doc(`users/${userId}`).get()
      if (!snap.exists) { res.status(404).send('user not found'); return }

      const user = snap.data() as UserInfo

      const ingredients = (user.ingredients || [])
        .filter((i: Ingredient) => !!i?.name)
        .map(i => ({ name: i!.name as string, quantity: i!.quantity })) as {
          name: string; quantity?: number
        }[]

      if (ingredients.length === 0) { res.status(204).send('no ingredients'); return }

      const prefs = (user.preferences || {}) as UserPreferences

      const recipe = await postWithOidc<GeneratedRecipe>(GENERATE_RECIPE_URL, {
        ingredients,
        prefs: {
          cuisine: prefs.cuisine,
          servings: prefs.servings ?? 2,
          maxTimeMin: prefs.maxTimeMin ?? 30,
          budgetYen: prefs.budgetYen ?? 800,
          exclude: prefs.exclude ?? [],
          tools: prefs.tools ?? [],
          locale: (prefs as any).locale ?? 'ja-JP',
        },
      })

      const lineUserId = (user as any).lineUserId as string | undefined
      if (!lineUserId) { res.status(400).send('LINE user not linked'); return }

      const text =
        `🍳 今日のレシピ: ${recipe.title}\n` +
        `所要時間: 約${recipe.time}分 / 予算: ~¥${recipe.budget}\n` +
        `材料: ${recipe.ingredients.map(i => i.quantity ? `${i.name}(${i.quantity})` : i.name).join('、')}\n\n` +
        `手順:\n${recipe.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`

      await postWithOidc<unknown>(LINE_PUSH_URL, {
        to: lineUserId,
        message: { type: 'text', text },
      })

      logger.info('LINE sent', { userId, dedupeKey })
      res.status(200).send('ok'); return
    } catch (e: any) {
      logger.error('notify failed', { err: e?.message, stack: e?.stack })
      res.status(500).send(e?.message ?? 'error'); return
    }
  }
)
