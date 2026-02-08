export function usePaneoAuth() {
  const config = useRuntimeConfig()

  const requiresPassword = computed(() => !!config.public.paneoAuthEnabled)
  const isUnlocked = useState<boolean>('paneo-auth-unlocked', () => false)
  const canAccessWorkspace = computed(() => !requiresPassword.value || isUnlocked.value)

  async function login(password: string) {
    if (!requiresPassword.value) {
      isUnlocked.value = true
      return true
    }

    try {
      await $fetch('/api/auth/login', {
        method: 'POST',
        body: { password }
      })
      isUnlocked.value = true
      return true
    } catch {
      isUnlocked.value = false
      return false
    }
  }

  async function logout() {
    if (!requiresPassword.value) {
      return
    }

    await $fetch('/api/auth/logout', { method: 'POST' })
    isUnlocked.value = false
  }

  return {
    requiresPassword,
    isUnlocked,
    canAccessWorkspace,
    login,
    logout
  }
}
