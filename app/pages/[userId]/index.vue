<script setup lang="ts">
import { onAuthStateChanged, getAuth } from "firebase/auth";
import { ref, onMounted } from "vue";
import type { Ingredient } from "~/@types/ingredients";

definePageMeta({
  middleware: "auth-client",
  layout:'with-sidebar',
  title: 'ホーム',
});
const userId = useRoute().params.userId as string;
const { getRecipeItems, addIngredient, updateIngredients } = useUserRecipes();
const { run } = useRecipeAgent()
const auth = getAuth();
const fetchedItems = ref<Ingredient[]>([]);
// 選択された料理スタイル（国）
const recipe = ref("");
const recipeAgentText = ref("");
const isLoading = ref(false);
const newIngredient = ref<Ingredient>({ name: "", quantity: 1 });

const handleAddIngredient = async () => {
  if (!newIngredient.value.name || newIngredient.value.quantity < 1) {
    alert("食材名と数量を正しく入力してください");
    return;
  }

  try {
    await addIngredient(userId, {
      name: newIngredient.value.name,
      quantity: newIngredient.value.quantity,
    });

    // 表示にも反映
    fetchedItems.value.push({ ...newIngredient.value });

    // フォーム初期化
    newIngredient.value = { name: "", quantity: 1 };
  } catch (e) {
    console.error("食材の追加に失敗しました:", e);
  }
};





const updateQuantity = async (index: number, quantity: number) => {
  if (quantity < 1) return;
  const item = fetchedItems.value[index];
  if (!item) return;

  item.quantity = quantity;
  await updateIngredients(userId, fetchedItems.value as Ingredient[]);
};


const deleteIngredient = async (index: number) => {
  fetchedItems.value.splice(index, 1);
  await updateIngredients(userId, fetchedItems.value as Ingredient[]);
};
const runResult = ref<{ recipeId: string; recipe: any } | null>(null)

const handleRunRecipeAgent = async () => {
  isLoading.value = true
  try {
    const res = await run()              
    runResult.value = res               
    recipeAgentText.value = JSON.stringify(res.recipe, null, 2)
  } catch (e: any) {
    console.error('runRecipeAgent 失敗:', e)
    alert(e?.message || 'エージェントの実行に失敗しました')
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const result = await getRecipeItems(userId);
      fetchedItems.value = result;
    } else {
      console.warn("ログインしていません");
    }
  });
});
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-white to-gray-100 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-4xl mx-auto space-y-10">
      <h1 class="text-4xl font-extrabold text-center text-gray-800">レシピAIアシスタント</h1>
      <div>
  </div>

      <!-- 食材一覧 -->
      <div>
        <h2 class="text-2xl font-semibold text-gray-700 mb-4">登録食材一覧</h2>
        <ul v-if="fetchedItems.length" class="grid grid-cols-2 sm:grid-cols-3 gap-3 text-gray-800">
          <li v-for="(item, index) in fetchedItems" :key="index"
            class="bg-white border rounded-lg shadow-sm px-4 py-2 text-center space-y-2">
            <div class="font-semibold">{{ item.name }}</div>
            <div class="flex items-center justify-center gap-2">
              <input type="number" class="w-16 border rounded px-2 py-1 text-center" v-model.number="item.quantity"
                @change="updateQuantity(index, item.quantity ?? 1)" min="1" />
              <button @click="deleteIngredient(index)" class="text-red-500 hover:text-red-700 text-sm">
                🗑 削除
              </button>
            </div>
          </li>

        </ul>
        <p v-else class="text-gray-500">食材がまだ登録されていません。</p>
      </div>
      <!-- 食材追加フォーム -->
      <div class="bg-white rounded-xl shadow p-6">
        <h2 class="text-xl font-bold text-gray-700 mb-4"> 食材を追加</h2>
        <div class="flex flex-col sm:flex-row gap-4">
          <input v-model="newIngredient.name" type="text" placeholder="食材名（例: にんじん）"
            class="flex-1 border border-gray-300 rounded-lg px-4 py-2" />
          <input v-model.number="newIngredient.quantity" type="number" min="1" placeholder="数量"
            class="w-32 border border-gray-300 rounded-lg px-4 py-2" />
          <button @click="handleAddIngredient"
            class="bg-blue-500 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-600">
            追加
          </button>
        </div>
      </div>


      <!-- レシピ生成ボタン -->
      <div class="text-center">
        <div class="h-3"></div>
        <button @click="handleRunRecipeAgent"
          class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-10 rounded-full shadow-lg transition-all duration-200 transform hover:scale-105"
          :disabled="isLoading">
          {{ isLoading ? '生成中...' : 'レシピを生成する' }}
        </button>
      </div>

      <!-- レシピ表示 -->
      <div v-if="recipe" class="bg-white border p-6 rounded-xl shadow-md whitespace-pre-wrap text-gray-800">
        {{ recipe }}
      </div>
      <div v-if="runResult" class="bg-white border p-6 rounded-xl shadow-md mt-4">
        <div class="text-sm text-gray-600 mb-2">
          保存ID: {{ runResult.recipeId }}
        </div>

        <h3 class="font-semibold text-lg mb-2">🍽 {{ runResult.recipe.title }}</h3>

        <div class="text-sm text-gray-700 mb-3">
          <span>人数: {{ runResult.recipe.servings }}</span> /
          <span>時間: {{ runResult.recipe.totalTimeMin }}分</span> /
          <span>難易度: {{ runResult.recipe.difficulty }}</span>
        </div>

        <h4 class="font-semibold">材料</h4>
        <ul class="list-disc pl-5 mb-4">
          <li v-for="(ing, i) in runResult.recipe.ingredients" :key="i">
            {{ ing.name }}：{{ ing.quantity }}{{ ing.unit || '' }}
          </li>
        </ul>

        <h4 class="font-semibold">作り方</h4>
        <ol class="list-decimal pl-5">
          <li v-for="(s, i) in runResult.recipe.steps" :key="i">
            {{ s.text }} <span v-if="s.tips" class="text-xs text-gray-500">（Tip: {{ s.tips }}）</span>
          </li>
        </ol>
      </div>
    </div>
  </div>
</template>
