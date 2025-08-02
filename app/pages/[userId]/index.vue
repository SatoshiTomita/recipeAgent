<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router';
import { ref } from 'vue';
import { useGenerateRecipe } from '~/composables/useGenerateRecipe';

const router = useRouter();
const userId = useRoute().params.userId as string;
const { generateRecipe } = useGenerateRecipe();
const { countries } = useCountries();
const goToOcr = () => {
  if (userId) {
    router.push(`/${userId}/ocr`);
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


// 選択された料理スタイル（国）
const cuisine = ref("日本");

// 生成されたレシピ
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
    <h1 class="text-2xl">レシピを生成する</h1>

    <button
      @click="goToOcr"
      class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
    >
      OCRページへ移動
    </button>

    <!-- 国の選択 -->
    <div>
      <h2 class="text-lg font-semibold mb-2">作りたい料理の国を選択してください：</h2>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="country in countries"
          :key="country.label"
          @click="cuisine = country.label"
          class="px-3 py-1 rounded-full border text-sm transition flex items-center gap-1"
          :class="cuisine === country.label ? 'bg-green-500 text-white' : 'bg-white hover:bg-gray-100'"
        >
          <span class="text-xl leading-none">{{ country.flag }}</span>
          <span>{{ country.label }}</span>
        </button>
      </div>
    </div>

    <!-- レシピ生成ボタン -->
    <div>
      <button
        @click="handleGenerateRecipe"
        class="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
        :disabled="isLoading"
      >
        {{ isLoading ? '生成中...' : 'レシピを生成する' }}
      </button>
    </div>

    <!-- レシピ表示 -->
    <div v-if="recipe" class="bg-gray-100 p-4 rounded whitespace-pre-wrap">
      {{ recipe }}
    </div>
  </div>
</template>
