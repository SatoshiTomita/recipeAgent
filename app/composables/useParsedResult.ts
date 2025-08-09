// composables/useUserRecipes.ts
import { getFirestore, doc, setDoc, arrayUnion, getDoc,updateDoc,increment,serverTimestamp } from "firebase/firestore";
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

export const incrementUserOcrTimes = async (uid: string, by = 1) => {
  const db = getFirestore()
  const ref = doc(db, 'users', uid)

  try {
    await updateDoc(ref, {
      ocrTimes: increment(by),
      updatedAt: serverTimestamp(),
    })
  } catch (e) {
    await setDoc(
      ref,
      {
        ocrTimes: by,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      },
      { merge: true }
    )
  }
}