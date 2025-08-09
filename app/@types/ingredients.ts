export type Item = {
  name: string;
  price: number;
  quantity: number;
};

export type Ingredient = {
  name?: string;
  quantity?: number;
};

export type StrictIngredient = { name: string; quantity: number };