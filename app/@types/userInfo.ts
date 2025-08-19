// @/types/user.ts
import type { Timestamp } from 'firebase/firestore';
import type { Ingredient } from '@/@types/ingredients';
export type UserPlan = 'standard' | 'premium';
export type UserPrefs = {
  cuisine?: string
  servings?: number
  maxTimeMin?: number
  budgetYen?: number
  exclude?: string[]
  tools?: string[]
}
export interface UserInfo {
  /** ユーザーの一意なID（Firebase UIDなど） */
  uid: string;

  /** 表示名 */
  displayName: string;

  /** メールアドレス（ログイン用や通知用） */
  email: string;

  /** プロフィール画像URL */
  avatarUrl?: string;

  /** 登録された食材リスト */
  ingredients: Ingredient[];

  /** アカウント作成日時 */
  createdAt: Timestamp;

  /** 最終更新日時（プロフィールや設定変更など） */
  updatedAt: Timestamp;

  /** 最終ログイン日時 */
  lastLogin: Timestamp;

  /** OCRを実行した回数 */
  ocrTimes: number;

  /** 指定した国 */
  nation: string;

  /** プラン種別 */
  plan: UserPlan;

  preferences?: UserPrefs;

  /** アプリ内ポイント（必要な場合） */
  points: number;

  /** アカウントの有効/無効状態 */
  isActive: boolean;
}
