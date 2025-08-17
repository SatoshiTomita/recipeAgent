export type UserPreferences = {
    cuisine?: string;          // '日本' | 'イタリアン' | '中華' | ...
    servings?: number;         // 2
    maxTimeMin?: number;       // 30
    budgetYen?: number;        // 800
    exclude?: string[];        // 嫌い/アレルゲン
    tools?: string[];          // ['レンジ','オーブン','フライパン']
    locale?: 'ja-JP'|'en-US';  // 単位/表記
  };