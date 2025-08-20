// composables/useLineMessaging.ts
import { httpsCallable } from "firebase/functions";

export const useLineMessaging = () => {
  const functions = useFunctions();

  // Functions 側で export した "linePush" を呼ぶ
  const linePush = httpsCallable(functions, "api_messaging_linePush-linePush");

  // 自分宛に Push 送信する
  const sendPushMessage = async (to: string, text: string) => {
    console.log("✅ useLineMessaging composable initialized");
    const result = await linePush({ to, text });
    return result.data; // { ok: true } が返る想定
  };

  // 全員宛て Broadcast を呼ぶ
  const lineBroadcast = httpsCallable(functions, "api_messaging_linePush-lineBroadcast");
  const sendBroadcastMessage = async (text: string) => {
    console.log("✅ Broadcast initialized");
    const result = await lineBroadcast({ text });
    return result.data;
  };

  return { sendPushMessage, sendBroadcastMessage };
};
