// composables/useFunctions.ts
import { getApp } from "firebase/app";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

let cached: ReturnType<typeof getFunctions> | null = null;

export const useFunctions = () => {
  if (cached) return cached;

  const functions = getFunctions(getApp(), "asia-northeast1");

  if (process.env.NODE_ENV === "development") {
    connectFunctionsEmulator(functions, "localhost", 5001);
  }

  cached = functions;
  return functions;
};
