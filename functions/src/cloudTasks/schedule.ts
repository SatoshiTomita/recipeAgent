import { onCall } from 'firebase-functions/v2/https'
import { CloudTasksClient } from '@google-cloud/tasks'
import * as logger from 'firebase-functions/logger'

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'recipeagent-cff98'
const LOCATION = 'asia-northeast1'
const QUEUE = 'recipe-notify-queue'
const TARGET_URL = `https://api-cloudtasks-notify-tasksrecipenotify-inljxzbgdq-an.a.run.app`
const TASKS_SA = `${PROJECT_ID}@appspot.gserviceaccount.com`

export const scheduleRecipeNotify = onCall(
  { region: LOCATION },
  async (req) => {
    const { userId, scheduledAt } = req.data as { userId: string; scheduledAt: string }
    if (!userId || !scheduledAt) throw new Error('userId and scheduledAt are required')

    const ts = Date.parse(scheduledAt)
    if (isNaN(ts)) throw new Error('scheduledAt is invalid')

    const sec = Math.floor(ts / 1000)
    const now = Math.floor(Date.now() / 1000)
    if (sec <= now) throw new Error('scheduledAt must be in the future')
    if (sec - now > 30 * 24 * 60 * 60) throw new Error('Cannot schedule more than 30 days ahead')

    // ✅ 正しいクライアント
    const client = new CloudTasksClient()
    const parent = client.queuePath(PROJECT_ID, LOCATION, QUEUE)

    const payload = { userId, dedupeKey: `notify-${userId}-${sec}` }

    const [task] = await client.createTask({
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

    logger.info('Task scheduled', { taskName: task.name, userId })
    return { ok: true, taskName: task.name }
  }
)
