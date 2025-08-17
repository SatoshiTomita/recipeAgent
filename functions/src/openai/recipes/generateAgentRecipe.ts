// functions/src/recipes/generateAgentRecipe.ts
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getFirestore } from 'firebase-admin/firestore'
import { generateAgentRecipeCore, OPENAI_API_KEY, Prefs } from './core'

export const generateAgentRecipe = onCall({
  region: 'asia-northeast1',
  invoker: 'public',
  secrets: [OPENAI_API_KEY],
}, async (req) => {
  const { pantry, preferences: inputPrefs = {}, seed } = req.data ?? {}
  if (!Array.isArray(pantry) || pantry.length === 0) throw new HttpsError('invalid-argument','pantry is empty')

  // 認証ユーザーの嗜好を取り込んでマージ
  let saved: Prefs = {}
  const uid = req.auth?.uid
  if (uid) {
    const snap = await getFirestore().doc(`users/${uid}`).get()
    saved = (snap.data()?.preferences ?? {}) as Prefs
  }
  const prefs = { ...saved, ...inputPrefs }

  return await generateAgentRecipeCore({ pantry, preferences: prefs, seed })
})
