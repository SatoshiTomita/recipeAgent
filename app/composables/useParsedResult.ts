import { getFirestore, collection, getDocs } from "firebase/firestore";
import type { Item } from '~/@types/ingredients'; 
export const useUserRecipes = () => {
  const getRecipeItems = async (uid: string) => {
    const db = getFirestore();
    const recipesRef = collection(db, "users", uid, "recipes");
    const snapshot = await getDocs(recipesRef);
    const items: Item[] = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      console.log("Recipe data:", data); // デバッグ用ログ
      console.log(data.parsedResult.items); // itemsの内容をログ出力
      if (data?.parsedResult?.items) {
        items.push(...data.parsedResult.items);
      }
    });

    return items;
  };

  return { getRecipeItems };
};
