import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

export const getAdminAuth = () => {
  const config = useRuntimeConfig()

  if (!getApps().length) {
    const projectId  = config.firebaseProjectId
    const clientEmail = config.firebaseClientEmail
    let privateKey    = config.firebasePrivateKey as string | undefined
    if (privateKey && privateKey.includes('\\n')) {
      privateKey = privateKey.replace(/\\n/g, '\n') // 環境変数の改行対策
    }

    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    })
  }
  return getAuth()
}
