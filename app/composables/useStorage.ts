import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { v4 as uuidv4 } from "uuid";

export const useStorage = () => {
  const uploadImage = async (file: File): Promise<string> => {
    console.log("uploadImage called (Firebase Storage)");

    const storage = getStorage();
    const filename = `uploads/${Date.now()}_${uuidv4()}_${file.name}`;
    const fileRef = storageRef(storage, filename);

    // ファイルアップロード
    await uploadBytes(fileRef, file);

    // 公開URL取得
    const downloadURL = await getDownloadURL(fileRef);
    return downloadURL;
  };

  return { uploadImage };
};
