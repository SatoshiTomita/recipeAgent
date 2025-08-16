<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { Ingredient } from '@/@types/ingredients'
import { getAuth } from 'firebase/auth'

const props = defineProps<{
  items: Ingredient[]
}>()

const emit = defineEmits(['close', 'saved'])

const { updateIngredients, getRecipeItems } = useUserRecipes()

type EditableIngredient = { name: string; quantity: number }
// ① props をそのままいじらない → 編集用にローカルコピー
const original = ref<EditableIngredient[]>([])
const formItems = ref<EditableIngredient[]>([])


watch(
  () => props.items,
  (val) => {
    const base: EditableIngredient[] = (val ?? []).map(i => ({
      name: (i.name ?? '').trim(),
      quantity: i.quantity ?? 1,
    }))
    original.value = JSON.parse(JSON.stringify(base)) as EditableIngredient[]
    formItems.value = JSON.parse(JSON.stringify(base)) as EditableIngredient[]
  },
  { immediate: true }
)

// ② 行操作
const addRow = () => formItems.value.push({ name: '', quantity: 1 })
const removeRow = (idx: number) => formItems.value.splice(idx, 1)
const inc = (row: EditableIngredient) =>
  (row.quantity = Math.max(1, (Number(row.quantity) || 1) + 1))
const dec = (row: EditableIngredient) =>
  (row.quantity = Math.max(1, (Number(row.quantity) || 1) - 1))
const resetToOcr = () => {
  formItems.value = JSON.parse(JSON.stringify(original.value)) as EditableIngredient[]
}
// ③ バリデーション／保存可否
const cleaned = computed(() =>
  formItems.value
    .map(i => ({ name: (i.name ?? '').trim(), quantity: Math.max(1, Number(i.quantity)) }))
    .filter(i => i.name.length > 0)
)
const canSave = computed(() => cleaned.value.length > 0)

// ④ 登録
const handleRegister = async () => {
  const user = getAuth().currentUser
  if (!user) return alert('ログインが必要です')

  try {
    const existing = await getRecipeItems(user.uid)

    // 同名は数量を合算してマージ（要件に合わせて重複の扱いは調整可）
    const merged = [...existing, ...cleaned.value]
    const unique = merged.reduce<Ingredient[]>((acc, item) => {
      const found = acc.find(i => i.name === item.name)
      if (found) {
        found.quantity = Math.max(1, (Number(found.quantity) || 1) + (Number(item.quantity) || 1))
      } else {
        acc.push({ name: item.name, quantity: item.quantity })
      }
      return acc
    }, [])

    await updateIngredients(user.uid, unique)
    emit('saved', unique)
    emit('close')
  } catch (e) {
    console.error('登録に失敗:', e)
    alert('登録に失敗しました')
  }
}
</script>

<template>
  <div class="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
    <div class="bg-white p-6 rounded-xl shadow-lg w-full max-w-2xl">
      <h2 class="text-lg font-semibold text-gray-800 mb-4">OCRで検出された食材（編集可）</h2>

      <!-- 編集テーブル -->
      <div class="space-y-2 max-h-[55vh] overflow-auto pr-1">
        <div v-for="(row, idx) in formItems" :key="idx" class="grid grid-cols-[1fr,180px,auto] gap-3 items-center">
          <!-- 品名 -->
          <input v-model="row.name" type="text" placeholder="食材名" class="border rounded-lg px-3 py-2 w-full" />

          <!-- 数量 -->
          <div class="flex items-center gap-2 flex-wrap sm:flex-nowrap min-w-[180px]">
            <button type="button" class="px-2 py-1 border rounded shrink-0" @click="dec(row)">－</button>
             <input  v-model.number="row.quantity"  type="number" min="1" 
              class="border rounded-lg px-3 py-2 w-16 sm:w-20 text-center shrink-0"  />
             <button type="button" class="px-2 py-1 border rounded shrink-0" @click="inc(row)">＋</button>
             </div>

          <!-- 削除 -->
          <button type="button" class="px-3 py-2 border rounded text-red-600" @click="removeRow(idx)">
            削除
          </button>
        </div>
      </div>

      <!-- 操作ボタン -->
      <div class="flex justify-between mt-5">
        <div class="flex gap-2">
          <button type="button" class="px-3 py-2 border rounded" @click="addRow">行を追加</button>
          <button type="button" class="px-3 py-2 border rounded" @click="resetToOcr">OCR値に戻す</button>
        </div>
        <div class="flex gap-2">
          <button type="button" class="px-3 py-2 border rounded" @click="$emit('close')">キャンセル</button>
          <button type="button" class="px-4 py-2 rounded text-white"
            :class="canSave ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'" :disabled="!canSave"
            @click="handleRegister">
            修正して登録
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
