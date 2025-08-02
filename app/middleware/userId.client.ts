// middleware/userId.client.ts
import { defineNuxtRouteMiddleware, navigateTo, useState } from "nuxt/app";
import { getAuth, onAuthStateChanged, type User } from "firebase/auth";
import { getFirestore, doc, getDoc } from "firebase/firestore";

// ユーザーの取得を Promise 化（onAuthStateChanged は非同期イベント）
function getCurrentUser(auth: ReturnType<typeof getAuth>): Promise<User | null> {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

export default defineNuxtRouteMiddleware(async () => {
  const auth = getAuth();
  const db = getFirestore();

  const user = await getCurrentUser(auth);

  // ユーザーが未ログインならリダイレクト
  if (!user) {
    return navigateTo("/login");
  }

  // 既に randomUserId が取得済みなら何もしない
  const randomUserIdState = useState<string | null>("randomUserId", () => null);
  if (randomUserIdState.value) return;

  try {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (!userDoc.exists()) {
      throw new Error("ユーザードキュメントが存在しません");
    }

    const data = userDoc.data();
    const randomUserId = data.randomUserId;

    if (!randomUserId || typeof randomUserId !== "string") {
      throw new Error("randomUserId が不正です");
    }

    randomUserIdState.value = randomUserId; // ✅ Nuxtのグローバルstateに保持

  } catch (err) {
    console.error("ユーザーID取得失敗:", err);
    return navigateTo("/login");
  }
});
