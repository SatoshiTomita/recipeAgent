// functions/src/index.ts
import * as functions from 'firebase-functions';
import vision from '@google-cloud/vision';
import { parseReceiptText } from "../utils/parseRecieptText";
import type { ParsedReceipt } from "../types/ocr";
import * as admin from 'firebase-admin';
import { setOcrResult } from "../utils/setOcrResult";
import { onCall } from "firebase-functions/v2/https";
if (!admin.apps.length) {
  admin.initializeApp();
}

interface OcrResult {
  status: string;
  receiptId: string;
  parsed: ParsedReceipt;
  text: string;
}
// クライアント初期化（Firebase 環境なら認証不要）
const client = new vision.ImageAnnotatorClient();
export const getOcrResult = onCall(
  async (request: functions.https.CallableRequest<{ imageUrl: string }>): Promise<OcrResult> => {
    const imageUrl = (request.data as { imageUrl?: string }).imageUrl;
    const uid = request.auth?.token?.uid;

    if (!imageUrl) {
      throw new functions.https.HttpsError("invalid-argument", "imageUrl is required");
    }
    if (!uid) {
      throw new functions.https.HttpsError("unauthenticated", "Authentication required");
    }

    try {
      const [documentResult] = await client.documentTextDetection(imageUrl);
      const text = documentResult.fullTextAnnotation?.text || "";
      const parsed: ParsedReceipt = parseReceiptText(text);

      console.log("📄 OCR全文結果:", text);
      console.log("📝 解析結果:", parsed);

      const saveResult = await setOcrResult(uid, { text, parsed });

      return {
        status: saveResult.status,
        receiptId: saveResult.id ?? "",
        parsed,
        text,
      };
    } catch (err: any) {
      console.error("Vision API error:", err);
      throw new functions.https.HttpsError("internal", err.message);
    }
  }
);
