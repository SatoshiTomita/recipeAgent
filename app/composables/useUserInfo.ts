// /composables/useUserInfoStore.ts
import { readonly, type Ref } from 'vue'
import type { UserInfo, UserPlan } from '@/@types/userInfo'
import type { Ingredient } from '@/@types/ingredients'

export const useUserInfoStore = (key = 'userInfo') => {
  return new UserInfoStore(key)
}

class UserInfoStore {
  private _state: Ref<UserInfo | null>

  constructor(key: string) {
    this._state = useState<UserInfo | null>(key, () => null)
  }

  /** 読み取り専用（外部から破壊されないように） */
  get state() {
    return readonly(this._state)
  }

  /** 編集用（v-model 等で必要なら） */
  get editState() {
    return this._state
  }

  /** 置き換え */
  set(data: UserInfo | null) {
    this._state.value = data
  }

  /** 部分更新（null なら何もしない） */
  patch(patch: Partial<UserInfo>) {
    if (!this._state.value) return
    this._state.value = { ...this._state.value, ...patch }
  }

  /** 全クリア */
  clear() {
    this._state.value = null
  }

  // ===== ユースケース別ヘルパ =====

  /** OCR回数 +1 */
  incrementOcrTimes() {
    if (!this._state.value) return
    this._state.value = {
      ...this._state.value,
      ocrTimes: (this._state.value.ocrTimes ?? 0) + 1,
    }
  }

  setNationLocal(nation: string) {
    if (!this._state.value) return
    this._state.value = { ...this._state.value, nation }
  }

  /** 食材を追加（同名があれば数量を加算） */
  addIngredient(ing: Ingredient) {
    if (!this._state.value) return
    const items = [...(this._state.value.ingredients ?? [])]
    const i = items.findIndex((x) => x.name === ing.name)
    if (i >= 0) {
      items[i] = {
        ...items[i],
        quantity: (items[i]?.quantity ?? 0) + (ing.quantity ?? 0),
      }
    } else {
      items.push(ing)
    }
    this._state.value = { ...this._state.value, ingredients: items }
  }

  /** 食材の数量を上書き（0以下なら削除） */
  setIngredientQuantity(name: string, qty: number) {
    if (!this._state.value) return
    let items = [...(this._state.value.ingredients ?? [])]
    const i = items.findIndex((x) => x.name === name)
    if (i === -1) return
    if (qty <= 0) {
      items = items.filter((x) => x.name !== name)
    } else {
      items[i] = { ...items[i], quantity: qty }
    }
    this._state.value = { ...this._state.value, ingredients: items }
  }

  /** 食材を削除 */
  removeIngredient(name: string) {
    if (!this._state.value) return
    const items = (this._state.value.ingredients ?? []).filter((x) => x.name !== name)
    this._state.value = { ...this._state.value, ingredients: items }
  }

  /** 食材をまとめて置換（OCR結果をそのまま流し込み） */
  replaceAllIngredients(list: Ingredient[]) {
    if (!this._state.value) return
    this._state.value = { ...this._state.value, ingredients: Array.isArray(list) ? [...list] : [] }
  }

  /** 国の設定 */
  setNation(nation: string) {
    if (!this._state.value) return
    this._state.value = { ...this._state.value, nation }
  }

  /** プラン変更 */
  setPlan(plan: UserPlan) {
    if (!this._state.value) return
    this._state.value = { ...this._state.value, plan }
  }

  /** ポイント加算（マイナスもOK） */
  addPoints(delta: number) {
    if (!this._state.value) return
    this._state.value = {
      ...this._state.value,
      points: (this._state.value.points ?? 0) + delta,
    }
  }
}
