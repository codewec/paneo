<script setup lang="ts">
const { locale, t } = useI18n()

function handleToastFocus(event: FocusEvent) {
  const target = event.target as HTMLElement | null
  if (!target?.closest('.ffile-toast-viewport')) {
    return
  }

  target.blur()
}

onMounted(() => {
  window.addEventListener('focusin', handleToastFocus, true)
})

onBeforeUnmount(() => {
  window.removeEventListener('focusin', handleToastFocus, true)
})

useHead(() => ({
  meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
  link: [{ rel: 'icon', href: '/favicon.ico' }],
  htmlAttrs: { lang: locale.value }
}))

useSeoMeta({
  title: 'fFile',
  description: t('app.description')
})
</script>

<template>
  <UApp
    :toaster="{
      position: 'bottom-right',
      duration: 3500,
      progress: true,
      max: 5,
      expand: true,
      ui: {
        viewport: 'ffile-toast-viewport !bottom-20'
      }
    }"
  >
    <NuxtPage />
  </UApp>
</template>
