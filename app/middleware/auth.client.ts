import { defineNuxtRouteMiddleware, navigateTo, useState } from "nuxt/app";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getApp } from "firebase/app";
// Firebase Auth の復元完了を待つ Promise
function waitForAuthReady(): Promise<void> {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(getAuth(), () => {
      unsub();
      resolve();
    });
  });
}

export default defineNuxtRouteMiddleware(async (to) => {
  if (!import.meta.client) return;
  await waitForAuthReady();

  const auth = getAuth();
  const user = auth.currentUser;
  const isAuthorized = useState<boolean | null>("isAuthorized", () => null);

  if (!user) {
    isAuthorized.value = null;
    if (to.path !== "/") {
      return navigateTo("/");
    }
    return;
  }

  if (isAuthorized.value === true) return;

  try {

    isAuthorized.value = true;
  } catch (err) {
    console.error("checkUser 呼び出しエラー:", err);
    isAuthorized.value = null;
    return navigateTo("/");
  }
});
