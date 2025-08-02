import admin from "firebase-admin";
import type { ParsedReceipt } from "../types/ocr";
const firestore = admin.firestore();

export const setOcrResult = async (
    uid: string,
    result: {
        text: string;
        parsed: ParsedReceipt;
    }
) => {
    try {
        const docRef = firestore
            .collection("users")
            .doc(uid)
            .collection("recipes")
            .doc();

        await docRef.set({
            ocrText: result.text,
            parsedResult: result.parsed,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log("✅ OCR結果を保存しました:", docRef.id);
        return { status: "success", id: docRef.id };
    } catch (error) {
        console.error("❌ OCR結果の保存に失敗:", error);
        return { status: "error", message: (error as Error).message };
    }
};
