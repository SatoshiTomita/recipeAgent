<script setup lang="ts">
import type { UserPrefs } from "@/@types/userInfo";
import { onAuthStateChanged, getAuth } from "firebase/auth";
const { getPrefs, upsertPrefs } = useUserPreferences();
definePageMeta({
  middleware: "auth-client",
  layout:'with-sidebar',
  title: 'レシピ設定',
});
const prefs = ref<UserPrefs>({
  servings: 2,
  maxTimeMin: 30,
  budgetYen: 800,
  exclude: [],
  tools: [],
});
const userId = useRoute().params.userId as string;
const excludeInput = ref("");
const toolsInput = ref("");
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
const auth = getAuth();
onMounted(() => {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const p = await getPrefs(userId);
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
    <!-- ★ 好み（preferences） -->
    <div class="bg-white rounded-xl shadow p-6">
        <h2 class="text-xl font-bold text-gray-700 mb-4">好み・条件（preferences）</h2>

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
</template>