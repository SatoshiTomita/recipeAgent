import { getFirestore, doc, getDoc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import type { UserPrefs } from '~/@types/userInfo'

export const useUserPreferences = () => {
  const db = getFirestore()

  const getPrefs = async (uid: string): Promise<UserPrefs> => {
    const snap = await getDoc(doc(db, 'users', uid))
    return (snap.data()?.preferences ?? {}) as UserPrefs
  }

  // ドキュメントが未作成の可能性に備えて setDoc フォールバック
  const upsertPrefs = async (uid: string, patch: Partial<UserPrefs>) => {
    const ref = doc(db, 'users', uid)
    try {
      await updateDoc(ref, { preferences: patch, updatedAt: serverTimestamp() })
    } catch {
      await setDoc(ref, { preferences: patch, updatedAt: serverTimestamp() }, { merge: true })
    }
  }

  return { getPrefs, upsertPrefs }
}