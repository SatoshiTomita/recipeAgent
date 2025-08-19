// functions/src/recipes/runRecipeAgent.ts
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { generateAgentRecipeCore, OPENAI_API_KEY, Prefs } from './core'
import type { PantryItem } from './core'

// ★ 国コード => 日本語ラベル（必要に応じて増やしてください）
const COUNTRY_LABEL_MAP: Record<string, string> = {
  JP: '日本',
  US: 'アメリカ',
  GB: 'イギリス',
  FR: 'フランス',
  IT: 'イタリア',
  CN: '中国',
  KR: '韓国',
  IN: 'インド',
}

export const runRecipeAgent = onCall({
  region: 'asia-northeast1',
  invoker: 'public',
  secrets: [OPENAI_API_KEY],
}, async (req) => {
  const uid = req.auth?.uid
  if (!uid) throw new HttpsError('unauthenticated', 'login required')

  const db = getFirestore()
  const userRef = db.doc(`users/${uid}`)
  const user = (await userRef.get()).data() || {}

  // 1) Firestoreの preferences を安全に展開
  const userPrefs = (user.preferences ?? {}) as Prefs

  // 2) cuisine が未指定なら nation(国コード) から日本語ラベルを作る
  const cuisineFromNation =
    !userPrefs.cuisine && typeof user.nation === 'string'
      ? (COUNTRY_LABEL_MAP[user.nation] ?? user.nation)  // マップに無ければコード文字列そのまま
      : undefined

  // 3) 不変合成で最終 prefs を作る（後勝ち）。以降は prefs を“使い切り”
  const basePrefs: Prefs = {
    ...userPrefs,
    ...(cuisineFromNation ? { cuisine: cuisineFromNation } : {}),
  }

  console.log('prefs(final before loop)', basePrefs)

  // ★ ingredients から Pantry を作る
  const arr = (user.ingredients ?? []) as any[]
  const pantry: PantryItem[] = arr
    .map((d: any) => ({
      name: String(d?.name ?? '').trim(),
      quantity: Number(d?.quantity ?? 0),
      unit: d?.unit ? String(d.unit) : undefined,
    }))
    .filter(it => it.name && Number.isFinite(it.quantity) && it.quantity > 0)

  if (pantry.length === 0) {
    throw new HttpsError('invalid-argument', 'pantry is empty (no items in users/{uid}.ingredients field)')
  }

  const runRef = userRef.collection('agentRuns').doc()
  await runRef.set({ step: 'plan', attempts: 0, createdAt: Timestamp.now(), updatedAt: Timestamp.now() })

  let best: any = null

  // ループ内で maxTimeMin を調整するので、毎回 “浅いコピー” を作って使う
  for (let i = 1; i <= 3; i++) {
    await runRef.update({ step: 'generate', attempts: i, updatedAt: Timestamp.now() })

    // ここで prefs を都度コピー（basePrefs を直接 mutate しない）
    const prefs: Prefs = { ...basePrefs }

    const recipe = await generateAgentRecipeCore({ pantry, preferences: prefs })

    const exclude = new Set((prefs.exclude || []).map(s => s.trim()))
    const usesExcluded = (recipe.ingredients || []).some((ing: any) => exclude.has((ing.name || '').trim()))
    const tooLong = prefs.maxTimeMin ? (recipe.totalTimeMin || 0) > prefs.maxTimeMin : false
    const tooManyMissing = (recipe.missing || []).length > 3

    if (!usesExcluded && !tooLong && !tooManyMissing) {
      best = recipe
      break
    }

    // 次トライに向けて basePrefs を緩めたい場合は「新しい base を作る」
    if (tooLong) {
      basePrefs.maxTimeMin = Math.floor((basePrefs.maxTimeMin || 30) * 1.2)
    }
  }

  if (!best) throw new HttpsError('failed-precondition', '条件内で良いレシピが見つかりませんでした')

  const saved = await userRef.collection('recipes').add({
    request: { preferences: basePrefs }, // 合成後の最終 prefs を保存
    result: best,
    createdAt: Timestamp.now()
  })

  await runRef.update({ step: 'done', resultId: saved.id, updatedAt: Timestamp.now() })
  return { recipeId: saved.id, recipe: best }
})
