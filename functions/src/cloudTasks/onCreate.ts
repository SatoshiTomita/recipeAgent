// functions/src/schedules/onCreate.ts
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { CloudTasksClient } from '@google-cloud/tasks'
import * as logger from 'firebase-functions/logger'
import { initializeApp, getApps } from 'firebase-admin/app'

if (getApps().length === 0) initializeApp()

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'recipeagent-cff98'
const LOCATION   = 'asia-northeast1'
const QUEUE      = 'recipe-notify-queue'
const TARGET_URL = 'https://api-cloudtasks-notify-tasksrecipenotify-inljxzbgdq-an.a.run.app'
const TASKS_SA   = `${PROJECT_ID}@appspot.gserviceaccount.com`

const tasks = new CloudTasksClient()
const parent = tasks.queuePath(PROJECT_ID, LOCATION, QUEUE)

export const onScheduleCreated = onDocumentCreated(
  {
    document: 'users/{userId}/schedules/{scheduleId}',
    region: LOCATION,
    // 任意: 大量作成時のバッチング調整はここで
  },
  async (event) => {
    const db = getFirestore()
    const { userId, scheduleId } = event.params
    const ref = db.doc(`users/${userId}/schedules/${scheduleId}`)
    const snap = event.data
    if (!snap) return

    const data = snap.data() as any

    // すでにキュー済みならスキップ（重複防止）
    if (data.taskName) {
      logger.debug('schedule already queued', { userId, scheduleId })
      return
    }
    if (!data.lineUserId) {
      logger.warn('lineUserId missing; skip queue', { userId, scheduleId })
      await ref.update({ status: 'FAILED', updatedAt: FieldValue.serverTimestamp() })
      return
    }

    // scheduledAt を epoch(sec)に正規化
    let tsMs: number | undefined
    if (data.scheduledAt?._seconds) {
      // Firestore Timestamp
      tsMs = data.scheduledAt._seconds * 1000
    } else if (typeof data.scheduledAt === 'number') {
      // epoch(ms) or epoch(sec) どちらでも受ける
      tsMs = data.scheduledAt > 10_000_000_000 ? data.scheduledAt : data.scheduledAt * 1000
    } else if (typeof data.scheduledAt === 'string') {
      const parsed = Date.parse(data.scheduledAt)
      if (!Number.isFinite(parsed)) tsMs = undefined
      else tsMs = parsed
    }

    if (!tsMs || !Number.isFinite(tsMs)) {
      await ref.update({ status: 'FAILED', updatedAt: FieldValue.serverTimestamp() })
      throw new Error('scheduledAt invalid')
    }

    const sec = Math.floor(tsMs / 1000)
    const now = Math.floor(Date.now() / 1000) + 1
    if (sec <= now) {
      await ref.update({ status: 'FAILED', updatedAt: FieldValue.serverTimestamp() })
      throw new Error('scheduledAt must be in the future')
    }
    if (sec - now > 30 * 24 * 60 * 60) {
      await ref.update({ status: 'FAILED', updatedAt: FieldValue.serverTimestamp() })
      throw new Error('Cannot schedule more than 30 days ahead')
    }

    // タスクペイロードは scheduleId 中心に（lineUserIdはサーバ側で参照）
    const payload = {
      userId,
      scheduleId,                        // ★ 後段でこのdocを読む
      dedupeKey: `notify-${userId}-${sec}`
    }

    const [task] = await tasks.createTask({
      parent,
      task: {
        httpRequest: {
          httpMethod: 'POST',
          url: TARGET_URL,
          headers: { 'Content-Type': 'application/json' },
          body: Buffer.from(JSON.stringify(payload)).toString('base64'),
          oidcToken: {
            serviceAccountEmail: TASKS_SA,
            audience: TARGET_URL,
          },
        },
        scheduleTime: { seconds: sec },
      },
    })

    await ref.update({
      status: 'QUEUED',
      taskName: task.name,
      dedupeKey: payload.dedupeKey,
      updatedAt: FieldValue.serverTimestamp(),
    })

    logger.info('Queued schedule', { userId, scheduleId, taskName: task.name })
  }
)
