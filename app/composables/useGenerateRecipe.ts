// composables/useGenerateRecipe.ts
import {  httpsCallable } from 'firebase/functions';
import type { Item } from '~/@types/ingredients'; // 必要に応じてパス調整

export const useGenerateRecipe = () => {
  const functions = useFunctions();

  // ✅ Cloud Functions の callable を定義
  const generateRecipeCallable = httpsCallable(functions, "api_openai_generateRecipe-generateRecipe");

  // ✅ 関数を呼び出すロジック
  const generateRecipe = async (items: Item[], cuisine: string = "日本"): Promise<string> => {
    try {
      const result = await generateRecipeCallable({
        items,
        cuisine
      });

      return (result.data as { recipe: string }).recipe;
    } catch (error) {
      console.error("レシピ生成に失敗:", error);
      throw new Error("レシピ生成中にエラーが発生しました");
    }
  };

  return {
    generateRecipe,
  };
};
