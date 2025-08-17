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

  const system = 'あなたは家庭料理のプロ。日本語で簡潔に。危険な調理は避ける。アレルゲン/除外食材は絶対に使わない。出力はJSONのみ。'
  const user = `
# 目的
手元の食材を優先し、${prefs.cuisine}の家庭料理を${prefs.servings}人分、${prefs.maxTimeMin}分以内、予算${prefs.budgetYen}円で作る。

# 制約
- 除外: ${(prefs.exclude||[]).join(', ') || 'なし'}
- 使用可能な器具: ${(prefs.tools||[]).join(', ') || '制約なし'}
- 単位/表記ロケール: ${prefs.locale}

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
    temperature: 0.7,
    seed,
  })

  const text = r.choices[0].message?.content ?? ''
  let json: any
  try { json = JSON.parse(text) } catch { throw new HttpsError('internal', 'LLM JSON parse failed') }
  if (!json?.ingredients || !json?.steps) throw new HttpsError('internal', 'invalid recipe shape')
  return json
}
