export type ParsedReceipt = {
  items: { name: string; price: number; quantity?: number }[];
  total: number;
  date?: string;
  store?: string;
};