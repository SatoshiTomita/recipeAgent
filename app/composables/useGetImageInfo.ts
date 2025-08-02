// composables/useGetImageInfo.ts
import { httpsCallable } from "firebase/functions";
export const useGetImageInfo = () => {
  const functions = useFunctions();
  const getImageInfo = httpsCallable(functions, "api_vision_getImageInfo-getImageInfo");

  const call = async (imageUrl: string): Promise<{ labels: string[]; text: string }> => {
    const result = await getImageInfo({ imageUrl });
    return result.data as any;
  };

  return { call };
};
