// functions/src/recipes/runRecipeAgent.ts
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { generateAgentRecipeCore, OPENAI_API_KEY, Prefs } from './core'
import type { PantryItem } from './core'
export const runRecipeAgent = onCall({
  region: 'asia-northeast1',
  invoker: 'public',
  secrets: [OPENAI_API_KEY],          // ★重要：コア内で secret を読むので必須
}, async (req) => {
  const uid = req.auth?.uid
  if (!uid) throw new HttpsError('unauthenticated', 'login required')

  const db = getFirestore()
  const userRef = db.doc(`users/${uid}`)
  const user = (await userRef.get()).data() || {}
  const prefs: Prefs = user.preferences || {}

  const pantrySnap = await userRef.collection('pantry').get()
  const pantry = pantrySnap.docs.map(d => d.data() as PantryItem)

  const runRef = userRef.collection('agentRuns').doc()
  await runRef.set({ step:'plan', attempts:0, createdAt:Timestamp.now(), updatedAt:Timestamp.now() })

  let best:any = null
  for (let i=1;i<=3;i++) {
    await runRef.update({ step:'generate', attempts:i, updatedAt:Timestamp.now() })

    const recipe = await generateAgentRecipeCore({ pantry, preferences: prefs })

    // 簡易評価
    const exclude = new Set((prefs.exclude||[]).map(s=>s.trim()))
    const usesExcluded = (recipe.ingredients||[]).some((ing:any)=>exclude.has((ing.name||'').trim()))
    const tooLong = prefs.maxTimeMin ? (recipe.totalTimeMin||0) > prefs.maxTimeMin : false
    const tooManyMissing = (recipe.missing||[]).length > 3

    if (!usesExcluded && !tooLong && !tooManyMissing) { best = recipe; break }

    // 軽い自動調整（例）
    if (tooLong) prefs.maxTimeMin = Math.floor((prefs.maxTimeMin||30) * 1.2)
  }

  if (!best) throw new HttpsError('failed-precondition','条件内で良いレシピが見つかりませんでした')

  const saved = await userRef.collection('recipes').add({
    request:{ preferences:prefs }, result:best, createdAt: Timestamp.now()
  })
  await runRef.update({ step:'done', resultId:saved.id, updatedAt:Timestamp.now() })
  return { recipeId: saved.id, recipe: best }
})
