import { onCall } from "firebase-functions/v2/https";
import { analyzeReceipt } from "../utils/analyrecipt";
import { setOcrResult } from "../utils/setOcrResult"; // ← これ追加

export const getReceiptData = onCall(async (request) => {
  const imageBase64 = request.data?.imageBase64;
  const uid = request.auth?.token?.uid;

  if (!uid) {
    throw new Error("未認証ユーザーです");
  }

  if (!imageBase64) {
    throw new Error("Missing base64 image");
  }

  const buffer = Buffer.from(imageBase64, "base64");
  const parsed = await analyzeReceipt(buffer);

  // Firestore に保存
  const saveResult = await setOcrResult(uid, {
    text: "raw image (base64) は省略可能", // raw OCR結果のtextが必要なら後で追加
    parsed: parsed,
  });

  return {
    parsed,
    receiptId: saveResult.id,
    status: saveResult.status,
  };
});
