// functions/src/recipes/runRecipeAgent.ts
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { generateAgentRecipeCore, OPENAI_API_KEY, Prefs } from './core'
import type { PantryItem } from './core'

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
  const prefs: Prefs = user.preferences || {}
  
  // ★ フィールド配列から取り出す
  const arr = (user.ingredients ?? []) as any[]
  const pantry: PantryItem[] = arr
    .map((d: any) => ({
      name: String(d.name ?? '').trim(),
      quantity: Number(d.quantity ?? 0),
      unit: d.unit ? String(d.unit) : undefined,
    }))
    .filter(it => it.name && Number.isFinite(it.quantity) && it.quantity > 0)
  
  if (pantry.length === 0) {
    throw new HttpsError('invalid-argument', 'pantry is empty (no items in users/{uid}.ingredients field)')
  }

  if (pantry.length === 0) {
    throw new HttpsError('invalid-argument', 'pantry is empty (no items in users/{uid}/ingredients)')
  }

  const runRef = userRef.collection('agentRuns').doc()
  await runRef.set({ step:'plan', attempts:0, createdAt:Timestamp.now(), updatedAt:Timestamp.now() })

  let best:any = null
  for (let i=1;i<=3;i++) {
    await runRef.update({ step:'generate', attempts:i, updatedAt:Timestamp.now() })

    const recipe = await generateAgentRecipeCore({ pantry, preferences: prefs })

    const exclude = new Set((prefs.exclude||[]).map(s=>s.trim()))
    const usesExcluded = (recipe.ingredients||[]).some((ing:any)=>exclude.has((ing.name||'').trim()))
    const tooLong = prefs.maxTimeMin ? (recipe.totalTimeMin||0) > prefs.maxTimeMin : false
    const tooManyMissing = (recipe.missing||[]).length > 3

    if (!usesExcluded && !tooLong && !tooManyMissing) { best = recipe; break }

    if (tooLong) prefs.maxTimeMin = Math.floor((prefs.maxTimeMin||30) * 1.2)
  }

  if (!best) throw new HttpsError('failed-precondition','条件内で良いレシピが見つかりませんでした')

  const saved = await userRef.collection('recipes').add({
    request:{ preferences:prefs }, result:best, createdAt: Timestamp.now()
  })
  await runRef.update({ step:'done', resultId:saved.id, updatedAt:Timestamp.now() })
  return { recipeId: saved.id, recipe: best }
})
