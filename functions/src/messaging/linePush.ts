// functions/src/index.ts
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";

// 🔐 LINEのチャネルアクセストークンをSecretで管理
// 事前に CLI でセット: firebase functions:secrets:set LINE_CHANNEL_ACCESS_TOKEN
const LINE_CHANNEL_ACCESS_TOKEN = defineSecret("LINE_CHANNEL_ACCESS_TOKEN");

// 任意：デプロイ先リージョン。日本なら asia-northeast1 推奨
const REGION = "asia-northeast1";

/**
 * callable: linePush
 * data: { to: string; text: string }
 * 例) to = "Your user ID", text = "テスト送信"
 */
export const linePush = onCall(
  { region: REGION, secrets: [LINE_CHANNEL_ACCESS_TOKEN] },
  async (request) => {
    try {
      // 認証必須にしたい場合：if (!request.auth) throw new HttpsError('unauthenticated', 'Login required');

      const { to, text } = (request.data ?? {}) as {
        to?: string;
        text?: string;
      };

      if (!to || !text) {
        throw new HttpsError(
          "invalid-argument",
          "`to` と `text` は必須です。"
        );
      }

      const res = await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN.value()}`, // ← Secret 呼び出し
        },
        body: JSON.stringify({
          to,
          messages: [{ type: "text", text }],
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new HttpsError(
          "internal",
          `LINE API error: ${res.status} ${body}`
        );
      }

      return { ok: true };
    } catch (err: any) {
      // 例外を HttpsError で統一
      if (err instanceof HttpsError) throw err;
      throw new HttpsError("internal", err?.message ?? "Unknown error");
    }
  }
);

/**
 * おまけ：全員宛てBroadcast（ユーザーID不要）
 * data: { text: string }
 */
export const lineBroadcast = onCall(
  { region: REGION, secrets: [LINE_CHANNEL_ACCESS_TOKEN] },
  async (request) => {
    const { text } = (request.data ?? {}) as { text?: string };
    if (!text) {
      throw new HttpsError("invalid-argument", "`text` は必須です。");
    }

    const res = await fetch("https://api.line.me/v2/bot/message/broadcast", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN.value()}`,
      },
      body: JSON.stringify({
        messages: [{ type: "text", text }],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new HttpsError("internal", `LINE API error: ${res.status} ${body}`);
    }

    return { ok: true };
  }
);
