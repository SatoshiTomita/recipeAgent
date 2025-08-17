<script setup lang="ts">
import { onAuthStateChanged, getAuth } from "firebase/auth";
import { ref, onMounted } from "vue";
import type { Ingredient } from "~/@types/ingredients";
const router = useRouter();
const userId = useRoute().params.userId as string;
const { generateRecipe } = useGenerateRecipe();
const { getRecipeItems, addIngredient, updateIngredients } = useUserRecipes();
const { generate, run } = useRecipeAgent()
definePageMeta({
  middleware: "auth-client",
});
const goToOcr = () => {
  if (userId) {
    router.push(`/${userId}/ocr`);
  } else {
    console.error("userId が取得できていません");
  }
};

const goToCountrySelector = () => {
  if (userId) {
    router.push(`/${userId}/countries`);
  } else {
    console.error("userId が取得できていません");
  }
};

// レシピ生成に使う食材
const items = ref([
  { name: "大根", price: 100, quantity: 1 },
  { name: "ひき肉", price: 200, quantity: 1 },
  { name: "にんじん", price: 80, quantity: 2 },
  { name: "玉ねぎ", price: 90, quantity: 1 },
  { name: "じゃがいも", price: 120, quantity: 3 },
  { name: "ピーマン", price: 60, quantity: 2 },
  { name: "キャベツ", price: 130, quantity: 1 },
  { name: "トマト", price: 150, quantity: 2 },
  { name: "豆腐", price: 90, quantity: 1 },
  { name: "卵", price: 60, quantity: 4 },
  { name: "小松菜", price: 110, quantity: 1 },
  { name: "しめじ", price: 100, quantity: 1 },
]);
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


const fetchedItems = ref<Ingredient[]>([]);
// 選択された料理スタイル（国）
const cuisine = ref("日本");
const recipe = ref("");
const recipeAgentText = ref("");
const isLoading = ref(false);

const handleGenerateRecipe = async () => {
  isLoading.value = true;
  try {
    recipe.value = await generateRecipe(items.value, cuisine.value);
  } catch (error) {
    console.error("レシピ生成に失敗しました:", error);
    recipe.value = "レシピの生成に失敗しました。";
  } finally {
    isLoading.value = false;
  }
};


const auth = getAuth();
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

const handleGenerateRecipeAgent = async () => {
  isLoading.value = true;
  try {
    const pantry = (fetchedItems.value || []).map(i => ({
      name: i.name,
      quantity: i.quantity ?? 1,
    }));
    const data = await generate({
      pantry,
      preferences: { cuisine: cuisine.value }, // 必要に応じて maxTimeMin なども追加
    });
    recipeAgentText.value = JSON.stringify(data, null, 2);
  } catch (e: any) {
    console.error("エージェント生成に失敗:", e);
    recipeAgentText.value = e?.message || "エージェント生成に失敗しました。";
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  onAuthStateChanged(auth, async (user) => {
    console.log("Auth state changed:", user);
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
      <h1 class="text-4xl font-extrabold text-center text-gray-800">🍳 レシピAIアシスタント</h1>

      <!-- ボタン群 -->
      <div class="flex flex-col sm:flex-row justify-center gap-4">
        <button @click="goToOcr"
          class="flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-xl shadow-md transition-transform transform hover:scale-105">
          <span>📷 OCRページへ</span>
        </button>
        <button @click="goToCountrySelector"
          class="flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-3 px-6 rounded-xl shadow-md transition-transform transform hover:scale-105">
          <span>🌍 国を選択する</span>
        </button>
      </div>

      <!-- 食材一覧 -->
      <div>
        <h2 class="text-2xl font-semibold text-gray-700 mb-4">🛒 食材一覧</h2>
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
        <h2 class="text-xl font-bold text-gray-700 mb-4">➕ 食材を追加</h2>
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
        <button @click="handleGenerateRecipe"
          class="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-10 rounded-full shadow-lg transition-all duration-200 transform hover:scale-105"
          :disabled="isLoading">
          {{ isLoading ? '生成中...' : '🍽 レシピを生成する' }}
        </button>
        <div class="h-3"></div>
        <button @click="handleGenerateRecipeAgent"
          class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-10 rounded-full shadow-lg transition-all duration-200 transform hover:scale-105"
          :disabled="isLoading">
          {{ isLoading ? '生成中...' : '🤖 パントリーから生成（嗜好反映）' }}
        </button>
      </div>

      <!-- レシピ表示 -->
      <div v-if="recipe" class="bg-white border p-6 rounded-xl shadow-md whitespace-pre-wrap text-gray-800">
        {{ recipe }}
      </div>
      <div v-if="recipeAgentText" class="bg-white border p-6 rounded-xl shadow-md mt-4">
        <pre class="whitespace-pre-wrap text-gray-800 text-sm">{{ recipeAgentText }}</pre>
      </div>
    </div>
  </div>
</template>
