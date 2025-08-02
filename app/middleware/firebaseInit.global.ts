import { initializeApp, getApp } from "firebase/app";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

export default defineNuxtRouteMiddleware(() => {
  const config = useRuntimeConfig().public;
  if (!config) {
    throw new Error("Runtime config is not found.");
  }
  if (!config.apiKey) {
    throw new Error("Runtime config apiKey is not found.");
  }
  if (!config.authDomain) {
    throw new Error("Runtime config authDomain is not found.");
  }
  if (!config.projectId) {
    throw new Error("Runtime config projectId is not found.");
  }
  if (!config.storageBucket) {
    throw new Error("Runtime config storageBucket is not found.");
  }
  if (!config.databaseURL) {
    throw new Error("Runtime config databaseURL is not found.");
  }

  initializeApp({
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
    storageBucket: config.storageBucket,
    databaseURL: config.databaseURL,
  });

  const functions = getFunctions(getApp());
  functions.region = "asia-northeast1";

  if (process.env.NODE_ENV === "development") {
    // 開発時はlocalhostを参照する
    connectFunctionsEmulator(functions, "localhost", 5001);
  }
});
