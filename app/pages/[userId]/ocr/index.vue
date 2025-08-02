<script setup lang="ts">
import { ref } from "vue";
import { getAuth } from "firebase/auth";
const file = ref<File | null>(null);
const result = ref<{ text: string } | null>(null);
const error = ref("");
const { getOcrResult } = useGetImageInfo(); // Cloud Functions 呼び出し
const { uploadImage } = useStorage();

const onFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement;
  file.value = target.files?.[0] || null;
};


const analyze = async () => {
  error.value = "";
  result.value = null;
   const user = getAuth().currentUser;
  if (!user) {
    error.value = "ログインが必要です";
    return;
  }

  if (!file.value) {
    error.value = "画像ファイルを選択してください";
    return;
  }

  try {
    console.log("アップロードするファイル:", file.value);
    console.log("アップロード開始");
    // const imageUrl = await uploadImage(file.value);
    const imageUrl="https://firebasestorage.googleapis.com/v0/b/recipeagent-cff98.firebasestorage.app/o/uploads%2F1754117725738_51742588-7340-4e72-ada0-e3e4306be2d0_%E3%82%B9%E3%82%AF%E3%83%AA%E3%83%BC%E3%83%B3%E3%82%B7%E3%83%A7%E3%83%83%E3%83%88%202025-08-02%20140132.png?alt=media&token=7b31484a-eae6-460c-b542-69cb3c58ac06"
    console.log("アップロードされた画像のURL:", imageUrl);
    const data = await getOcrResult(imageUrl);
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
