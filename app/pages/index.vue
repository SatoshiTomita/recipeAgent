<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { getAuth, onAuthStateChanged, signInWithPopup, signInWithEmailAndPassword, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

const auth = getAuth();
const db = getFirestore();
const router = useRouter();

const email = ref('');
const password = ref('');
const error = ref('');

// ページロード時に認証状態をチェック
onMounted(() => {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      // ユーザーがログイン済みの場合、ダッシュボードなどの保護されたルートへリダイレクト
      router.push(`/${user.uid}`);
    }
  });
});

const loginWithGoogle = async () => {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    await ensureUserDoc(result.user.uid);
    router.push(`/${result.user.uid}`);
  } catch (err: any) {
    error.value = err.message || 'Googleログインに失敗しました';
  }
};

const loginWithEmail = async () => {
  try {
    const result = await signInWithEmailAndPassword(
      auth,
      email.value,
      password.value
    );
    await ensureUserDoc(result.user.uid);
    router.push(`/${result.user.uid}`);
  } catch (err: any) {
    error.value = err.message || 'メールログインに失敗しました';
  }
};

const ensureUserDoc = async (uid: string) => {
  const userRef = doc(db, 'users', uid);
  const snapshot = await getDoc(userRef);
  if (!snapshot.exists()) {
    await setDoc(userRef, {});
  }
};
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
    <div class="bg-white rounded-2xl shadow-xl p-10 text-center w-full max-w-sm animate-fade-in space-y-4">
      <h1 class="text-2xl font-bold text-gray-800">ようこそ</h1>
      <p class="text-gray-600">ログイン方法を選んでください</p>

      <!-- Googleログイン -->
      <button
        @click="loginWithGoogle"
        class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-xl w-full transition"
      >
        Googleでログイン
      </button>

      <div class="border-t border-gray-300 my-4"></div>

      <!-- メールログインフォーム -->
      <input
        type="email"
        v-model="email"
        placeholder="メールアドレス"
        class="w-full border border-gray-300 p-2 rounded"
      />
      <input
        type="password"
        v-model="password"
        placeholder="パスワード"
        class="w-full border border-gray-300 p-2 rounded"
      />
      <button
        @click="loginWithEmail"
        class="bg-black hover:bg-gray-800 text-white font-semibold py-2 px-4 rounded-xl w-full transition"
      >
        メールでログイン
      </button>

      <p v-if="error" class="text-red-600 text-sm mt-2">{{ error }}</p>
    </div>
  </div>
</template>

<style scoped>
@keyframes fade-in {
  0% {
    opacity: 0;
    transform: translateY(20px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}
.animate-fade-in {
  animation: fade-in 0.8s ease-out;
}
</style>