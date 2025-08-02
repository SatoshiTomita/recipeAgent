<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router';
import { ref } from 'vue';
const router = useRouter();
const userId = useRoute().params.userId as string;
const { generateRecipe } = useGenerateRecipe();
const goToOcr = () => {
  if (userId) {
    router.push(`/${userId}/ocr`);
  } else {
    console.error("userId が取得できていません");
  }
};
const items = ref([
  { name: "大根", price: 100, quantity: 1 },
  { name: "ひき肉", price: 200, quantity: 1 },
  { name: "にんじん", price: 80, quantity: 2 }
]);

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
</script>


<template>
  <div class="p-8 space-y-6">
    <h1 class="text-2xl">ここにログイン後のページを作成する</h1>

    <button
      @click="goToOcr"
      class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
    >
      OCRページへ移動
    </button>

    <div>
      <button
        @click="handleGenerateRecipe"
        class="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
        :disabled="isLoading"
      >
        {{ isLoading ? '生成中...' : 'レシピを生成する' }}
      </button>
    </div>

    <div v-if="recipe" class="bg-gray-100 p-4 rounded whitespace-pre-wrap">
      {{ recipe }}
    </div>
  </div>
</template>
