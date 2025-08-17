// composables/usePantry.ts
import { getFirestore, doc, collection, getDocs, setDoc, writeBatch, deleteDoc } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

export type PantryItem = { name: string; quantity: number; unit?: string }

const slug = (s: string) =>
  s.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}-]/gu, '')

export const usePantry = () => {
  const db = getFirestore()
  const uid = () => getAuth().currentUser?.uid

  // 一覧取得
  const getPantryItems = async (): Promise<PantryItem[]> => {
    const id = uid(); if (!id) throw new Error('not logged in')
    const snap = await getDocs(collection(doc(db, 'users', id), 'pantry'))
    return snap.docs.map(d => d.data() as PantryItem)
  }

  // 1件追加/上書き（name を docId にする）
  const addPantryItem = async (item: PantryItem) => {
    const id = uid(); if (!id) throw new Error('not logged in')
    const ref = doc(collection(doc(db, 'users', id), 'pantry'), slug(item.name))
    await setDoc(ref, item, { merge: true })
  }

  // 複数まとめて上書き（存在しないものは削除したい場合）
  const replacePantry = async (items: PantryItem[]) => {
    const id = uid(); if (!id) throw new Error('not logged in')
    const col = collection(doc(db, 'users', id), 'pantry')
    const batch = writeBatch(db)

    // 既存を全削除 → 再作成（必要なら部分更新方式に変更可）
    const existing = await getDocs(col)
    existing.forEach(d => batch.delete(d.ref))
    items.forEach(it => {
      const ref = doc(col, slug(it.name))
      batch.set(ref, it)
    })
    await batch.commit()
  }

  // 1件削除
  const removePantryItem = async (name: string) => {
    const id = uid(); if (!id) throw new Error('not logged in')
    await deleteDoc(doc(collection(doc(db, 'users', id), 'pantry'), slug(name)))
  }

  return { getPantryItems, addPantryItem, replacePantry, removePantryItem }
}
