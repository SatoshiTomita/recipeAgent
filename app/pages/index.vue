<script setup lang="ts">
import { getAuth, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { useRouter } from 'vue-router';

const auth = getAuth();
const db = getFirestore();
const router = useRouter();

const createRandomId = (length = 8): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

const login = async () => {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  const user = result.user;

  const userRef = doc(db, 'users', user.uid);
  const snapshot = await getDoc(userRef);

  let randomUserId: string;

  if (snapshot.exists()) {
    // 既存のランダムID取得
    randomUserId = snapshot.data().randomUserId;
  } else {
    // 新規ユーザー → ランダムID生成して保存
    randomUserId = createRandomId();
    await setDoc(userRef, { randomUserId });
  }

  // ✅ ページ遷移
  router.push(`/${randomUserId}`);
};
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
    <div class="bg-white rounded-2xl shadow-xl p-10 text-center w-full max-w-sm animate-fade-in">
      <h1 class="text-2xl font-bold mb-6 text-gray-800">ようこそ</h1>
      <p class="text-gray-600 mb-8">Googleアカウントでログインしてください</p>
      <button
        @click="login"
        class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl shadow-lg transition duration-200 ease-in-out transform hover:scale-105"
      >
        <svg class="inline-block w-5 h-5 mr-2" viewBox="0 0 48 48">
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8a12 12 0 010-24c3.1 0 6 1.2 8.2 3.2l6.1-6.1A20 20 0 0024 4a20 20 0 100 40c11 0 20-9 20-20 0-1.3-.1-2.5-.4-3.5z"/>
          <path fill="#FF3D00" d="M6.3 14.6l6.6 4.9A11.9 11.9 0 0124 12c3.1 0 6 1.2 8.2 3.2l6.1-6.1A19.9 19.9 0 0024 4c-7.3 0-13.7 4-17.3 10.1z"/>
          <path fill="#4CAF50" d="M24 44c5.3 0 10.1-2 13.6-5.3l-6.3-5.2a12 12 0 01-17.6-4.7l-6.6 5.1C10.3 39.5 16.7 44 24 44z"/>
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 01-4.2 5.3l6.3 5.2c3.6-3.3 6.2-8.1 6.2-13.5 0-1.3-.1-2.5-.4-3.5z"/>
        </svg>
        Googleでログイン
      </button>
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
