type AuthStatusResponse = {
  requiresPassword: boolean
  isAuthenticated: boolean
}

export function usePaneoAuth() {
  const requiresPassword = useState<boolean>('paneo-auth-requires-password', () => false)
  const isUnlocked = useState<boolean>('paneo-auth-unlocked', () => false)
  const initialized = useState<boolean>('paneo-auth-initialized', () => false)
  const initializing = useState<boolean>('paneo-auth-initializing', () => false)

  const canAccessWorkspace = computed(() => !requiresPassword.value || isUnlocked.value)

  function applyStatus(status: AuthStatusResponse) {
    requiresPassword.value = !!status.requiresPassword
    isUnlocked.value = !!status.isAuthenticated
    initialized.value = true
  }

  async function initialize(force = false) {
    if (!force && (initialized.value || initializing.value)) {
      return
    }

    initializing.value = true
    try {
      const fetcher = import.meta.server ? useRequestFetch() : $fetch
      const response = await fetcher<AuthStatusResponse>('/api/auth/status')
      applyStatus(response)
    } finally {
      initializing.value = false
    }
  }

  async function login(password: string) {
    try {
      const response = await $fetch<AuthStatusResponse>('/api/auth/login', {
        method: 'POST',
        body: { password }
      })
      applyStatus(response)
      return true
    } catch {
      isUnlocked.value = false
      return false
    }
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    await initialize(true)
  }

  return {
    requiresPassword,
    isUnlocked,
    canAccessWorkspace,
    initialize,
    login,
    logout
  }
}
