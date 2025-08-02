import { httpsCallable } from "firebase/functions";
export const useGetImageInfo = () => {
  const functions = useFunctions();
  const getImageInfo = httpsCallable(functions, "api_documentAI_getReceiptData-getReceiptData");

  const getOcrResult = async (file: File): Promise<any> => {
    const base64 = await toBase64(file); // ✅ ここで変換
    const result = await getImageInfo({ imageBase64: base64 }); // ✅ 正しいキー名で送信
    return result.data;
  };

  return { getOcrResult };
};

// base64変換用ヘルパー
function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1]; // "data:image/png;base64,..." を除去
      if (base64 !== undefined) {
        resolve(base64);
      } else {
        reject(new Error("Failed to convert file to base64."));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
