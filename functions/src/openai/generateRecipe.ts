import { onCall } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import OpenAI from "openai";
import * as functions from "firebase-functions";
import type { Item } from "../types/ingredients";

// ✅ defineSecret に登録名を渡す
const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");



export const generateRecipe = onCall({ secrets: [OPENAI_API_KEY] }, async (request) => {
  const items: Item[] = request.data?.items;
  const cuisine: string = request.data?.cuisine || "日本";

  if (!Array.isArray(items) || items.length === 0) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "items は1つ以上の { name, price, quantity } を含む配列である必要があります"
    );
  }

  const formattedIngredients = items.map((item) => {
    const unit = item.quantity > 1 ? `${item.quantity}個` : "1個";
    return `${item.name}（${unit}）`;
  });

  const prompt = `
以下の食材だけを使って、${cuisine}料理のレシピを考えてください。
家庭で簡単に作れてコストがかからない料理が望ましいです。
食材の数量は以下の通りです。

食材:
${formattedIngredients.join("\n")}

レシピをステップ形式でわかりやすく教えてください。
`;

  // ✅ defineSecret で取得したキーを使って OpenAI を初期化
  const openai = new OpenAI({
    apiKey: OPENAI_API_KEY.value(),
  });

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    const recipe = completion.choices[0].message?.content ?? "レシピが生成できませんでした。";

    return {
      recipe,
    };
  } catch (error) {
    console.error("OpenAI API error:", error);
    throw new functions.https.HttpsError(
      "internal",
      "レシピ生成中にエラーが発生しました"
    );
  }
});

