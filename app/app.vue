<script setup lang="ts">
const { locale, t } = useI18n()

useHead(() => ({
  meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
  link: [{ rel: 'icon', href: '/favicon.ico' }],
  htmlAttrs: { lang: locale.value }
}))

useSeoMeta(() => ({
  title: 'fFile',
  description: t('app.description')
}))
</script>

<template>
  <UApp>
    <NuxtPage />
  </UApp>
</template>
