<script setup lang="ts">
import { ref } from "vue";
const file = ref<File | null>(null);
const result = ref<{ text: string } | null>(null);
const error = ref("");
const { call } = useGetImageInfo(); // Cloud Functions 呼び出し
const { uploadImage } = useStorage();

const onFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement;
  file.value = target.files?.[0] || null;
};

const analyze = async () => {
  error.value = "";
  result.value = null;

  if (!file.value) {
    error.value = "画像ファイルを選択してください";
    return;
  }

  try {
    console.log("アップロードするファイル:", file.value);
    console.log("アップロード開始");
    const imageUrl = await uploadImage(file.value);
    console.log("アップロードされた画像のURL:", imageUrl);
    const data = await call(imageUrl);
    result.value = data;
  } catch (err: any) {
    error.value = err.message || "解析に失敗しました";
  }
};
</script>

<template>
  <div class="p-4">
    <input type="file" accept="image/*" @change="onFileChange" class="mb-2" />
    <button @click="analyze" class="bg-blue-500 text-white px-4 py-2 rounded">OCR 実行</button>

    <div v-if="result" class="mt-4">
      <h2>結果:</h2>
      <pre>{{ result.text }}</pre>
    </div>

    <div v-if="error" class="text-red-600 mt-4">{{ error }}</div>
  </div>
</template>
