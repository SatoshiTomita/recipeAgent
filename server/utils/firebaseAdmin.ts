// server/utils/firebaseAdmin.ts
import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app'
import { getAuth as _getAdminAuth } from 'firebase-admin/auth'

let initialized = false

export const ensureAdminApp = () => {
  if (!initialized) {
    const projectId   = process.env.FIREBASE_PROJECT_ID
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
    let privateKey    = process.env.FIREBASE_PRIVATE_KEY
    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('Missing Firebase Admin credentials env')
    }
    privateKey = privateKey.replace(/\\n/g, '\n') // 改行復元が超重要

    if (!getApps().length) {
      initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
      })
    }
    initialized = true
  }
  return getApp()
}

export const getAdminAuth = () => {
  ensureAdminApp()
  return _getAdminAuth()
}
