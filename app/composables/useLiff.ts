import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    getFirestore,
    setDoc,
    serverTimestamp,
} from "firebase/firestore";
import { getAuth } from 'firebase/auth'

// サービス毎のアカウント情報取得
export const getTargetLiffAccount = async (serviceType: string) => {
    try {
        const db = getFirestore();
        const docRef = doc(db, "configs", serviceType);
        const snap = await getDoc(docRef);

        if (!snap.exists()) {
            throw new Error(`liffConfigs/${serviceType} が見つかりません`);
        }

        const data = snap.data();
        return data as LiffAccount;
    } catch (error) {
        console.error("liffId 取得エラー", error);
        return undefined;
    }
};

// liff userの保存
export const saveLiffUser = async (opts: { targetUid?: string; user: LiffUser }) => {
    const db = getFirestore()
    const authUid = getAuth().currentUser?.uid
    const targetUid = opts.targetUid ?? authUid
  
    // デバッグ：何が渡ってきているか確認
    console.log('[saveLiffUser] args:', { targetUid, authUid, user: opts.user })
  
    if (!targetUid) throw new Error('saveLiffUser: targetUid is empty and no authenticated user')
    if (!opts.user) throw new Error('saveLiffUser: user payload is empty')
  
    // Firestore は undefined を拒否するので null/'' に寄せる
    const lineUserId = opts.user.userId ?? ''
    const displayName = opts.user.displayName ?? ''
    const pictureUrl = opts.user.pictureUrl ?? null
  
    const userRef = doc(db, 'users', targetUid)
    await setDoc(
      userRef,
      {
        lineUserId,
        lineProfile: {
          userId: lineUserId,
          displayName,
          pictureUrl,
        },
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    )
  }

// liff userの取得
export const getLiffUsers = async (
    serviceType: string,
    eventId: string,
): Promise<LiffUser[]> => {
    try {
        const db = getFirestore();

        const liffUsersRCol = collection(db, serviceType, eventId, "users");

        const snapshot = await getDocs(liffUsersRCol);
        return snapshot.docs.map((doc) => ({
            userId: doc.id,
            ...(doc.data() as Omit<LiffUser, "userId">),
        }));
    } catch (error) {
        console.error("liff user 取得エラー", error);
        return [];
    }
};

// liff userの削除
export const deleteLiffUser = async (
    serviceType: string,
    eventId: string,
    userId: string,
) => {
    try {
        const db = getFirestore();
        await deleteDoc(doc(db, serviceType, eventId, "users", userId));

        console.log("liff userを削除しました", userId);
    } catch (error) {
        console.error("liff user削除に失敗しました", error);
    }
};

/**
 * iffId ドキュメントを取得。
 * ドキュメントがなければ空文字を返す。
 */
// liffIdの追加
export const saveLiffIdByEventId = async (
    serviceType: string,
    eventId: string,
    liffId: string,
): Promise<void> => {
    if (!serviceType || !eventId) {
        throw new Error("serviceType または eventId が不足しています");
    }

    const db = getFirestore();
    const ref = doc(db, serviceType, eventId);
    await setDoc(ref, { liffId }, { merge: true });
};

// liffIdの取得
export const getLiffIdByEventId = async (
    eventId: string,
): Promise<string> => {
    if ( !eventId) {
        throw new Error(" eventId が不足しています");
    }
    const db = getFirestore();
    const liffDocRef = doc(db, "users",eventId);
    const snap = await getDoc(liffDocRef);

    if (!snap.exists()) return "";

    const data = snap.data() as { liffId?: string };
    return data.liffId ?? "";
};
