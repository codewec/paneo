<script setup lang="ts">
const route = useRoute()
const password = ref('')
const isSubmitting = ref(false)
const errorMessage = ref('')
const { requiresPassword, initialize, login } = usePaneoAuth()

const redirectPath = computed(() => {
  const raw = route.query.redirect
  if (typeof raw !== 'string') {
    return '/'
  }

  let value = raw
  try {
    value = decodeURIComponent(raw)
  } catch {
    value = raw
  }

  return value.startsWith('/') ? value : '/'
})

async function submit() {
  if (isSubmitting.value) {
    return
  }

  isSubmitting.value = true
  errorMessage.value = ''
  try {
    const ok = await login(password.value)
    if (!ok) {
      errorMessage.value = 'Invalid password'
      return
    }

    await navigateTo(redirectPath.value, { replace: true })
  } finally {
    isSubmitting.value = false
  }
}

await initialize()

if (!requiresPassword.value) {
  await navigateTo(redirectPath.value, { replace: true })
}
</script>

<template>
  <div class="flex h-[100dvh] w-full items-center justify-center bg-default p-4">
    <UCard class="w-full max-w-md">
      <template #header>
        <h1 class="text-base font-semibold">
          Paneo Login
        </h1>
      </template>

      <form
        class="space-y-3"
        @submit.prevent="submit"
      >
        <UFormField
          label="Password"
          class="w-full"
        >
          <UInput
            v-model="password"
            class="w-full"
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
          :loading="isSubmitting"
          label="Login"
        />
      </form>
    </UCard>
  </div>
</template>
