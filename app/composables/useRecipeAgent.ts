// composables/useRecipeAgent.ts
import { httpsCallable } from 'firebase/functions'
// 型は必要に応じて
export type PantryItem = { name: string; quantity: number; unit?: string }
export type Prefs = {
  cuisine?: string; servings?: number; maxTimeMin?: number; budgetYen?: number;
  exclude?: string[]; tools?: string[]; locale?: 'ja-JP'|'en-US';
}

export const useRecipeAgent = () => {
  const fns = useFunctions()

  // ★ 関数名は実デプロイ名に合わせる
  const gen = httpsCallable<
    { pantry: PantryItem[]; preferences?: Prefs; seed?: number },
    any
  >(fns, 'api_openai_recipes_generaeteAgentRecipes-generateAgentRecipe')

  const run = httpsCallable<Record<string, never>, { recipeId: string; recipe: any }>(
    fns, 'api_openai_recipes_runRecipeAgent-runRecipeAgent'
  )

  return {
    generate: async (payload: { pantry: PantryItem[]; preferences?: Prefs; seed?: number }) => {
      const r = await gen(payload); return r.data
    },
    run: async () => {
      const r = await run({} as any); return r.data
    }
  }
}
