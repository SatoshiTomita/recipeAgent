<script setup lang="ts">
import type { Ingredient } from '@/@types/ingredients';
import { getAuth } from 'firebase/auth';
const props = defineProps<{
  items: Ingredient[];
}>();

const emit = defineEmits(["close"]);

const { updateIngredients, getRecipeItems } = useUserRecipes();

const handleRegister = async () => {
  const user = getAuth().currentUser;
  if (!user) return alert("ログインが必要です");

  try {
    const existing = await getRecipeItems(user.uid);
    const merged = [...existing, ...props.items];

    // 重複を削除（名前でユニークにしたい場合）
    const unique = merged.reduce<Ingredient[]>((acc, item) => {
      const found = acc.find(i => i.name === item.name);
      if (!found) acc.push(item);
      return acc;
    }, []);

    await updateIngredients(user.uid, unique);
    alert("登録しました！");
    emit("close");
  } catch (e) {
    console.error("登録に失敗:", e);
    alert("登録に失敗しました");
  }
};
</script>

<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
    <div class="bg-white p-6 rounded-xl shadow-lg max-w-md w-full space-y-4">
      <h2 class="text-lg font-semibold text-gray-800">OCRで検出された食材</h2>
      <ul class="text-gray-700 text-sm space-y-1">
        <li v-for="(item, index) in items" :key="index">
          {{ item.name }} <span v-if="item.quantity">×{{ item.quantity }}</span>
        </li>
      </ul>
      <div class="flex justify-end gap-2">
        <button @click="emit('close')" class="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400">キャンセル</button>
        <button @click="handleRegister" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          登録する
        </button>
      </div>
    </div>
  </div>
</template>
