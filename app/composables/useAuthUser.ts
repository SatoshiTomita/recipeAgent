import { ref } from 'vue'
import { getAuth, onAuthStateChanged, type User } from 'firebase/auth'

export function useAuthUser() {
  const authReady = ref(false)
  const currentUser = ref<User | null>(null)
  let unsubscribe: (() => void) | null = null

  const subscribe = () => {
    if (unsubscribe) return unsubscribe
    unsubscribe = onAuthStateChanged(getAuth(), (u) => {
      currentUser.value = u
      authReady.value = true
    })
    return () => { if (unsubscribe) { unsubscribe(); unsubscribe = null } }
  }

  const ensureUser = () =>
    new Promise<User | null>((resolve) => {
      if (currentUser.value) return resolve(currentUser.value)
      const off = onAuthStateChanged(getAuth(), (u) => { off(); resolve(u) })
    })

  return { authReady, currentUser, ensureUser, subscribe }
}


