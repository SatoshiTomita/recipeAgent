<script setup lang="ts">
import { useRouter } from 'vue-router';

const router = useRouter();
const userId=useRoute().params.userId as string;

// ページ遷移関数
const goToOcr = () => {
  if (userId) {
    router.push(`/${userId}/ocr`);
  } else {
    console.error("userId が取得できていません");
  }
};
</script>

<template>
  <div class="p-8">
    <h1 class="text-2xl mb-6">ここにログイン後のページを作成する</h1>
    <button
      @click="goToOcr"
      class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
    >
      OCRページへ移動
    </button>
  </div>
</template>
