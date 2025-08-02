// composables/useGetImageInfo.ts
import { httpsCallable } from "firebase/functions";
export const useGetImageInfo = () => {
  const functions = useFunctions();
  const getImageInfo = httpsCallable(functions, "api_visionAPI_getOcrResult-getOcrResult");

  const getOcrResult = async (imageUrl: string): Promise<{ labels: string[]; text: string }> => {
    const result = await getImageInfo({ imageUrl });
    return result.data as any;
  };

  return { getOcrResult };
};
