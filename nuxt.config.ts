// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxtjs/i18n'
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    fileManagerRoots: process.env.FILE_MANAGER_ROOTS || '',
    public: {
      paneoAuthPassword: process.env.NUXT_PUBLIC_PANEO_AUTH_PASSWORD || '',
      uploadChunkSizeMb: Number(process.env.NUXT_PUBLIC_UPLOAD_CHUNK_SIZE_MB || 1),
      uploadChunkDelayMs: Number(process.env.NUXT_PUBLIC_UPLOAD_CHUNK_DELAY_MS || 10)
    }
  },

  compatibilityDate: '2025-01-15',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },

  i18n: {
    strategy: 'no_prefix',
    defaultLocale: 'ru',
    detectBrowserLanguage: false,
    locales: [
      { code: 'ru', name: 'Русский', language: 'ru-RU', file: 'ru.json' },
      { code: 'en', name: 'English', language: 'en-US', file: 'en.json' },
      { code: 'zh-Hant', name: '繁體中文', language: 'zh-Hant', file: 'zh-Hant.json' },
      { code: 'de', name: 'Deutsch', language: 'de-DE', file: 'de.json' },
      { code: 'es', name: 'Español', language: 'es-ES', file: 'es.json' }
    ],
    langDir: 'locales'
  }
})
