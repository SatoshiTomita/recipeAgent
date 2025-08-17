// functions/src/recipes/core.ts
import OpenAI from 'openai'
import { defineSecret } from 'firebase-functions/params'
import { HttpsError } from 'firebase-functions/v2/https'

export type PantryItem = { name: string; quantity: number; unit?: string }
export type Prefs = {
  cuisine?: string; servings?: number; maxTimeMin?: number; budgetYen?: number;
  exclude?: string[]; tools?: string[]; locale?: 'ja-JP'|'en-US';
}

export const OPENAI_API_KEY = defineSecret('OPENAI_API_KEY')

const defaults: Required<Pick<Prefs,'cuisine'|'servings'|'maxTimeMin'|'budgetYen'|'exclude'|'tools'|'locale'>> = {
  cuisine:'日本', servings:2, maxTimeMin:30, budgetYen:800, exclude:[], tools:[], locale:'ja-JP'
}

export async function generateAgentRecipeCore(params: {
  pantry: PantryItem[];
  preferences?: Prefs;
  seed?: number;
}) {
  const { pantry, preferences = {}, seed } = params
  if (!Array.isArray(pantry) || pantry.length === 0) {
    throw new HttpsError('invalid-argument', 'pantry is empty')
  }
  const prefs = { ...defaults, ...preferences }

  const system =
    'あなたは家庭料理のプロ。日本語で簡潔に。危険な調理は避ける。アレルゲン/除外食材は絶対に使わない。' +
    '必ずJSONオブジェクトのみを返し、前後に文章やコードブロック```を付けないこと。' // ← 明示

  const user = `
# 目的
手元の食材を優先し、${prefs.cuisine}の家庭料理を${prefs.servings}人分、${prefs.maxTimeMin}分以内、予算${prefs.budgetYen}円で作る。

# 制約
- 除外: ${(prefs.exclude||[]).join(', ') || 'なし'}
- 使用可能な器具: ${(prefs.tools||[]).join(', ') || '制約なし'}
- 単位/表記ロケール: ${prefs.locale}
- ingredients[*].quantity は数値、単位は必ず unit に分離（例：200 と "g"）

# 手持ち食材
${pantry.map(p=>`${p.name}:${p.quantity}${p.unit??''}`).join(', ')}

# 出力(JSONのみ)
{
 "title": "...",
 "servings": number,
 "totalTimeMin": number,
 "difficulty": "easy|normal|hard",
 "ingredients": [{"name":"...", "quantity": number, "unit":"g|個|..."}],
 "steps": [{"order":1, "text":"...", "tips":"..."}],
 "missing": [{"name":"...", "quantity": number, "unit":"..."}],
 "notes": ["..."],
 "nutrition": {"kcal": number, "protein": number, "fat": number, "carb": number}
}
`.trim()

  const ai = new OpenAI({ apiKey: OPENAI_API_KEY.value() })
  const r = await ai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role:'system', content: system }, { role:'user', content: user }],
    temperature: 0.6,         // 構造崩れ軽減
    seed,
    max_tokens: 1000,         // 過度な長文化を抑える
    response_format: { type: 'json_object' }, // ★ JSONモード
  })

  const raw = r.choices[0].message?.content ?? ''

  // まず素直に
  let json: any
  try {
    json = JSON.parse(raw)
  } catch (_e) {
    // 前後に余計な文字が混入した時の保険（{}でサンドされた部分だけを抽出）
    try {
      json = parseJsonLoose(raw)
    } catch (e2) {
      console.error('[generateAgentRecipeCore] raw head:', raw.slice(0, 400))
      throw new HttpsError('internal', 'LLM JSON parse failed')
    }
  }

  // 形チェック（最低限）
  if (!json || !Array.isArray(json.ingredients) || !Array.isArray(json.steps)) {
    throw new HttpsError('internal', 'invalid recipe shape')
  }

  // 量・単位の軽い正規化（任意だが安全）
  json.ingredients = json.ingredients.map((it: any) => ({
    name: String(it?.name ?? '').trim(),
    quantity: Number(it?.quantity ?? 0),
    unit: it?.unit ? String(it.unit) : undefined,
  })).filter((it: any) => it.name && Number.isFinite(it.quantity) && it.quantity >= 0)

  json.steps = json.steps.map((s: any, idx: number) => ({
    order: Number(s?.order ?? idx+1),
    text: String(s?.text ?? '').trim(),
    tips: s?.tips ? String(s.tips) : ''
  })).filter((s: any) => s.text)

  return json
}

// 波括弧で囲まれた最外の JSON オブジェクトを推定抽出
function parseJsonLoose(text: string) {
  const s = text.indexOf('{')
  const e = text.lastIndexOf('}')
  if (s === -1 || e === -1 || e <= s) throw new Error('no json object detected')
  return JSON.parse(text.slice(s, e + 1))
}
