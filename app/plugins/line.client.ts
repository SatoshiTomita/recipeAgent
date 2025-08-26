import { liff } from "@line/liff";
import { LiffMockPlugin } from "@line/liff-mock";

export default defineNuxtPlugin(() => ({
  provide: {
    async liffInit(liffId: string, userId: string) {
      const pub = useRuntimeConfig().public as any;

      const isNgrokHost = () => {
        if (typeof window === "undefined") return false;
        const h = window.location.hostname;
        return (
          /\.ngrok\.io$/.test(h) ||
          /\.ngrok\.app$/.test(h) ||
          /\.ngrok-free\.app$/.test(h)
        );
      };

      // モックを使うかどうか：明示フラグ優先
      const useMock = pub.liffUseMock === true ? true : false;

      try {
        if (useMock) {
          // ← 明示フラグが true のときのみモック
          liff.use(new LiffMockPlugin());
          // @ts-ignore
          await liff.init({ liffId, mock: true });
          if (!liff.isLoggedIn()) liff.login();
        } else {
          // 本物ログイン（ngrok でもこちらに入る）
          await liff.init({ liffId });
          if (!liff.isLoggedIn()) {
            liff.login({ redirectUri: window.location.href });
            return null; // リダイレクト
          }
        }

        const profile = await liff.getProfile();
        const liffUser: LiffUser = {
          userId: profile.userId,
          displayName: profile.displayName,
          pictureUrl: profile.pictureUrl ?? "",
        };

        await saveLiffUser(userId, liffUser);

        return {
          userId: profile.userId,
          displayName: profile.displayName,
          pictureUrl: profile.pictureUrl ?? null,
        };
      } catch (e) {
        console.error("LIFF ログインに失敗しました", e);
        return null;
      }
    },
  },
}));
