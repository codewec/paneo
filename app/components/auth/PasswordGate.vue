<script setup lang="ts">
const SESSION_KEY = 'paneo.auth.unlocked'

const config = useRuntimeConfig()
const passwordInput = ref('')
const errorMessage = ref('')
const isUnlocked = ref(false)

const requiresPassword = computed(() =>
  String(config.public.paneoAuthPassword || '').trim().length > 0
)

function readSessionState() {
  if (!import.meta.client) {
    return false
  }

  return sessionStorage.getItem(SESSION_KEY) === '1'
}

function persistSessionState(value: boolean) {
  if (!import.meta.client) {
    return
  }

  sessionStorage.setItem(SESSION_KEY, value ? '1' : '0')
}

function verifyPassword(input: string) {
  // This is a temporary client-side gate to keep page flow ready for future server auth.
  // TODO: replace with server-side session/token validation.
  const expected = String(config.public.paneoAuthPassword || '')
  if (!expected) {
    return input.trim().length > 0
  }

  return input === expected
}

function submitPassword() {
  errorMessage.value = ''
  if (!verifyPassword(passwordInput.value)) {
    errorMessage.value = 'Invalid password'
    return
  }

  isUnlocked.value = true
  persistSessionState(true)
  passwordInput.value = ''
}

onMounted(() => {
  if (!requiresPassword.value) {
    isUnlocked.value = true
    return
  }

  isUnlocked.value = readSessionState()
})
</script>

<template>
  <slot v-if="isUnlocked || !requiresPassword" />

  <div
    v-else
    class="flex h-[100dvh] w-full items-center justify-center bg-default p-4"
  >
    <UCard class="w-full max-w-md">
      <template #header>
        <h1 class="text-base font-semibold">
          Paneo Login
        </h1>
      </template>

      <form
        class="space-y-3"
        @submit.prevent="submitPassword"
      >
        <UFormField label="Password">
          <UInput
            v-model="passwordInput"
            type="password"
            autofocus
          />
        </UFormField>

        <p
          v-if="errorMessage"
          class="text-sm text-error"
        >
          {{ errorMessage }}
        </p>

        <UButton
          type="submit"
          block
          color="primary"
          icon="i-lucide-log-in"
          label="Login"
        />
      </form>
    </UCard>
  </div>
</template>
