<script setup lang="ts">
import { onAuthStateChanged, getAuth } from "firebase/auth";
import { ref, onMounted } from "vue";
const router = useRouter();
const userId = useRoute().params.userId as string;
const { generateRecipe } = useGenerateRecipe();
const { getRecipeItems } = useUserRecipes();

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


const fetchedItems = ref<{ name: string; quantity?: number }[]>([]);

// 選択された料理スタイル（国）
const cuisine = ref("日本");
const recipe = ref("");
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

onMounted(() => {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const userId = user.uid; 
      // const result = await getRecipeItems(userId);
      // fetchedItems.value = result;
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
        <button
          @click="goToOcr"
          class="flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-xl shadow-md transition-transform transform hover:scale-105"
        >
          <span>📷 OCRページへ</span>
        </button>
        <button
          @click="goToCountrySelector"
          class="flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-3 px-6 rounded-xl shadow-md transition-transform transform hover:scale-105"
        >
          <span>🌍 国を選択する</span>
        </button>
      </div>

      <!-- 食材一覧 -->
      <div>
        <h2 class="text-2xl font-semibold text-gray-700 mb-4">🛒 食材一覧</h2>
        <ul v-if="fetchedItems.length" class="grid grid-cols-2 sm:grid-cols-3 gap-3 text-gray-800">
          <li
            v-for="(item, index) in fetchedItems"
            :key="index"
            class="bg-white border rounded-lg shadow-sm px-4 py-2 text-center"
          >
            {{ item.name }}<br />
            <span class="text-sm text-gray-500">×{{ item.quantity ?? 1 }}</span>
          </li>
        </ul>
        <p v-else class="text-gray-500">食材がまだ登録されていません。</p>
      </div>

      <!-- レシピ生成ボタン -->
      <div class="text-center">
        <button
          @click="handleGenerateRecipe"
          class="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-10 rounded-full shadow-lg transition-all duration-200 transform hover:scale-105"
          :disabled="isLoading"
        >
          {{ isLoading ? '生成中...' : '🍽 レシピを生成する' }}
        </button>
      </div>

      <!-- レシピ表示 -->
      <div v-if="recipe" class="bg-white border p-6 rounded-xl shadow-md whitespace-pre-wrap text-gray-800">
        {{ recipe }}
      </div>
    </div>
  </div>
</template>

