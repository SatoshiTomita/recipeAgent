<script setup lang="ts">
import { ref } from "vue";
import { getAuth } from "firebase/auth";
const file = ref<File | null>(null);
const result = ref<{ text: string } | null>(null);
const error = ref("");
const { getOcrResult } = useGetImageInfo(); // Cloud Functions 呼び出し
const { uploadImage } = useStorage();
const previewUrl = ref<string | null>(null);
const onFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement;
  const selected = target.files?.[0] || null;
  file.value = selected;
  if (selected) {
    previewUrl.value = URL.createObjectURL(selected);
  } else {
    previewUrl.value = null;
  }
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
    const data = await getOcrResult(file.value); // ✅ 修正ここ
    result.value = data;
  } catch (err: any) {
    error.value = err.message || "解析に失敗しました";
  }
};

</script>

<template>
  <div class="max-w-xl mx-auto p-6 bg-white shadow-lg rounded-xl mt-10">
    <h1 class="text-2xl font-bold text-gray-800 mb-4 text-center">レシートOCR</h1>

    <label
      class="block w-full cursor-pointer border-2 border-dashed border-gray-300 rounded-lg p-6 text-center text-gray-500 hover:border-blue-400 transition">
      <!-- ✅ previewUrl がないときだけ表示 -->
      <span v-if="!previewUrl" class="block mb-2">画像ファイルを選択</span>

      <input type="file" accept="image/*" @change="onFileChange" class="hidden" />

      <!-- ✅ プレビュー画像 -->
      <div v-if="previewUrl" class="mt-2 text-center">
        <img :src="previewUrl" alt="プレビュー" class="max-w-full max-h-80 mx-auto rounded-lg shadow" />
      </div>
    </label>



    <button @click="analyze"
      class="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded transition">
      OCR 実行
    </button>

    <div v-if="result" class="mt-6 bg-gray-100 p-4 rounded-lg">
      <h2 class="text-lg font-semibold text-gray-700 mb-2">OCR結果</h2>
      <pre class="whitespace-pre-wrap break-words text-sm text-gray-800">{{ result.text }}</pre>
    </div>

    <div v-if="error" class="mt-4 text-red-600 font-semibold text-center">
      {{ error }}
    </div>
  </div>
</template>
