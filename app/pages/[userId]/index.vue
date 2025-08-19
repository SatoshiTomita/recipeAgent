<script setup lang="ts">
import { onAuthStateChanged, getAuth } from "firebase/auth";
import { ref, onMounted } from "vue";
import type { Ingredient } from "~/@types/ingredients";
import type { UserPrefs } from "@/@types/userInfo";
definePageMeta({
  middleware: "auth-client",
});
const router = useRouter();
const userId = useRoute().params.userId as string;
const { generateRecipe } = useGenerateRecipe();
const { getRecipeItems, addIngredient, updateIngredients } = useUserRecipes();
const { generate, run } = useRecipeAgent()
const { getPrefs, upsertPrefs } = useUserPreferences();
const auth = getAuth();
const fetchedItems = ref<Ingredient[]>([]);
// 選択された料理スタイル（国）
const cuisine = ref("日本");
const recipe = ref("");
const recipeAgentText = ref("");
const isLoading = ref(false);
const newIngredient = ref<Ingredient>({ name: "", quantity: 1 });
const excludeInput = ref("");
const toolsInput = ref("");
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

const prefs = ref<UserPrefs>({
  servings: 2,
  maxTimeMin: 30,
  budgetYen: 800,
  exclude: [],
  tools: [],
});

const normalizePrefsFromInputs = () => {
  prefs.value.exclude = excludeInput.value
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  prefs.value.tools = toolsInput.value
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
};

const savePrefs = async () => {
  normalizePrefsFromInputs();
  await upsertPrefs(userId, prefs.value);
  alert("好み（preferences）を保存しました");
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
    const res = await run()               // { recipeId, recipe }
    runResult.value = res                 // ← ここに格納
    // 任意：すぐ使えるようにも文字列化しておく
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
    console.log("Auth state changed:", user);
    if (user) {
      const result = await getRecipeItems(userId);
      const p = await getPrefs(userId);
      fetchedItems.value = result;
      prefs.value = { ...prefs.value, ...p };
      excludeInput.value = (prefs.value.exclude ?? []).join(", ");
      toolsInput.value = (prefs.value.tools ?? []).join(", ");
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
      <!-- ★ 好み（preferences） -->
      <div class="bg-white rounded-xl shadow p-6">
        <h2 class="text-xl font-bold text-gray-700 mb-4">✨ 好み・条件（preferences）</h2>

        <div class="grid sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm text-gray-600 mb-1">料理スタイル（例: 日本, イタリア）</label>
            <input v-model="prefs.cuisine" type="text" class="w-full border rounded-lg px-3 py-2" placeholder="日本" />
          </div>

          <div>
            <label class="block text-sm text-gray-600 mb-1">人数（servings）</label>
            <input v-model.number="prefs.servings" type="number" min="1" class="w-full border rounded-lg px-3 py-2" />
          </div>

          <div>
            <label class="block text-sm text-gray-600 mb-1">最大時間（分）</label>
            <input v-model.number="prefs.maxTimeMin" type="number" min="1" class="w-full border rounded-lg px-3 py-2" />
          </div>

          <div>
            <label class="block text-sm text-gray-600 mb-1">予算（円）</label>
            <input v-model.number="prefs.budgetYen" type="number" min="0" class="w-full border rounded-lg px-3 py-2" />
          </div>

          <div class="sm:col-span-2">
            <label class="block text-sm text-gray-600 mb-1">除外食材（カンマ区切り）</label>
            <input v-model="excludeInput" type="text" class="w-full border rounded-lg px-3 py-2"
              placeholder="乳, えび, そば" />
          </div>

          <div class="sm:col-span-2">
            <label class="block text-sm text-gray-600 mb-1">使える器具（カンマ区切り）</label>
            <input v-model="toolsInput" type="text" class="w-full border rounded-lg px-3 py-2"
              placeholder="電子レンジ, オーブン, フライパン" />
          </div>


        </div>

        <div class="mt-4">
          <button @click="savePrefs"
            class="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2 rounded-lg">
            保存
          </button>
        </div>
      </div>

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
        <button @click="handleRunRecipeAgent"
          class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-10 rounded-full shadow-lg transition-all duration-200 transform hover:scale-105"
          :disabled="isLoading">
          {{ isLoading ? '生成中...' : '🤖 パントリーから生成' }}
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
