// composables/useUserRecipes.ts
import { getFirestore, doc, setDoc, arrayUnion, getDoc } from "firebase/firestore";
import type { Ingredient } from "@/@types/ingredients";

export const useUserRecipes = () => {
  const db = getFirestore();

  const getRecipeItems = async (userId: string) => {
    const docRef = doc(db, "users", userId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data().ingredients ?? [] : [];
  };

  const updateIngredients = async (userId: string, newIngredients: Ingredient[]) => {
    const docRef = doc(db, "users", userId);
    await setDoc(docRef, { ingredients: newIngredients }, { merge: true });
  };

  const addIngredient = async (userId: string, ingredient: Ingredient) => {
    const docRef = doc(db, "users", userId);
    await setDoc(docRef, {
      ingredients: arrayUnion(ingredient),
    },{merge: true});
  };

  return {
    getRecipeItems,
    addIngredient,
    updateIngredients
  };
};

export const useParsedResult = () => {
  const db = getFirestore();

  const getParsedItems = async (
    userId: string,
    recipeId: string
  ): Promise<Ingredient[]> => {
    const docRef = doc(db, "users", userId, "recipes", recipeId);
    const snap = await getDoc(docRef);

    if (!snap.exists()) return [];

    const data = snap.data();
    return data.parsedResult?.items ?? [];
  };

  return { getParsedItems };
};
