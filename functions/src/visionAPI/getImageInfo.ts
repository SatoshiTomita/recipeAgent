// functions/src/index.ts
import * as functions from 'firebase-functions';
import vision from '@google-cloud/vision';

// クライアント初期化（Firebase 環境なら認証不要）
const client = new vision.ImageAnnotatorClient();
export const getImageInfo = functions.https.onCall(async (data, context) => {
  const imageUrl =
    (data as { imageUrl?: string }).imageUrl ??
    (data as any)?.data?.imageUrl;

  if (!imageUrl) {
    throw new functions.https.HttpsError("invalid-argument", "imageUrl is required");
  }

  try {
    // ✅ レシートのような構造文書には documentTextDetection を使う
    const [documentResult] = await client.documentTextDetection(imageUrl);

    const text = documentResult.fullTextAnnotation?.text || "";
    const labels: string[] = []; // ラベルは不要なら空にしておく

    console.log("📄 OCR全文結果:", text);

    return {
      labels,
      text,
    };
  } catch (err: any) {
    console.error("Vision API error:", err);
    throw new functions.https.HttpsError("internal", err.message);
  }
});