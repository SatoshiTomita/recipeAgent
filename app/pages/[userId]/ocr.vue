<script setup lang="ts">
import { ref, onMounted } from "vue";
import { getAuth, onAuthStateChanged, type User } from "firebase/auth";
import { Timestamp } from "firebase/firestore";
import type { StrictIngredient, Ingredient } from "~/@types/ingredients";
definePageMeta({ middleware: "auth-client",layout:"with-sidebar",title: 'OCR',});
const userStore = useUserInfoStore();
const waitForAuthReady = (): Promise<User | null> => {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(getAuth(), (user) => {
      unsubscribe();
      resolve(user);
    });
  });
};

const file = ref<File | null>(null);
const result = ref<{ parsed?: { items: { name: string; quantity?: number }[] } } | null>(null);
const route = useRoute(); // ✅ 追加
const userId = route.params.userId as string; 
const error = ref("");
const { getOcrResult } = useGetImageInfo();
const { uploadImage } = useStorage();
const previewUrl = ref<string | null>(null);
const onFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement;
  const selected = target.files?.[0] || null;
  file.value = selected;
  previewUrl.value = selected ? URL.createObjectURL(selected) : null;
};
const showModal = ref(false);

const analyze = async () => {
  error.value = "";
  result.value = null;
  if (!file.value) {
    error.value = "画像ファイルを選択してください";
    return;
  }

  try {
    console.log("アップロードするファイル:", file.value);
    const data = await getOcrResult(file.value);
    console.log("OCR結果:", data);
    result.value = data;

    const normalized: StrictIngredient[] =
      (data?.parsed?.items as Ingredient[] ?? [])
        .map((i: Ingredient) => ({
          name: (i.name ?? '').trim(),
          quantity: i.quantity ?? 1,
        }))
        .filter((i) => i.name.length > 0);


    // ストアが未初期化なら最低限で初期化（ログイン後なら uid 等も反映）
    if (!userStore.state.value) {
      const authUser = getAuth().currentUser;
      userStore.set({
        uid: authUser?.uid ?? "anonymous",
        displayName: authUser?.displayName ?? "",
        email: authUser?.email ?? "",
        avatarUrl: undefined,
        ingredients: [],
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        lastLogin: Timestamp.now(),
        ocrTimes: 0,
        nation: "JP",
        plan: "standard",
        points: 0,
        isActive: true,
      });
    }
    if (userId) {
      try {
        await incrementUserOcrTimes(userId, 1);
      } catch (e) {
        console.warn("incrementUserOcrTimes failed:", e);
      }
    }
    userStore.replaceAllIngredients(normalized); // 食材一覧を格納
    userStore.incrementOcrTimes();               // カウント+1

    if (normalized.length) {
      showModal.value = true;
    }
  } catch (err: any) {
    error.value = err.message || "解析に失敗しました";
  }
};

onMounted(async () => {
  const user = await waitForAuthReady();
  if (user) {
    console.log("✅ ログイン中のユーザー：", user.uid);
    // 任意：初回だけストアを初期化したい場合はここでも可
    if (!userStore.state.value) {
      userStore.set({
        uid: user.uid,
        displayName: user.displayName ?? "",
        email: user.email ?? "",
        avatarUrl: undefined,
        ingredients: [],
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        lastLogin: Timestamp.now(),
        ocrTimes: 0,
        nation: "JP",
        plan: "standard",
        points: 0,
        isActive: true,
      });
    }
  } else {
    console.log("❌ 未ログイン");
  }
});
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
    <OcrResult v-if="showModal" :items="result?.parsed?.items ?? []" @close="showModal = false" />
    <div v-if="error" class="mt-4 text-red-600 font-semibold text-center">
      {{ error }}
    </div>
  </div>
</template>
