<script setup lang="ts">
import type { LocaleCode } from '~/types/locale'

type ThemeMode = 'light' | 'dark'
type LocaleOption = { label: string, value: LocaleCode }

const props = defineProps<{
  open: boolean
  selectedLanguage: LocaleCode
  languageOptions: LocaleOption[]
  currentTheme: ThemeMode
  canLogout: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'update:selectedLanguage': [value: LocaleCode]
  'setTheme': [value: ThemeMode]
  'logout': []
}>()

const { t } = useI18n()

const modelOpen = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value)
})

const modelLanguage = computed({
  get: () => props.selectedLanguage,
  set: (value: LocaleCode) => emit('update:selectedLanguage', value)
})
</script>

<template>
  <UModal
    v-model:open="modelOpen"
    :title="t('modal.settings')"
  >
    <template #body>
      <div class="space-y-4">
        <div class="space-y-2">
          <p class="text-sm text-muted">
            {{ t('settings.language') }}
          </p>
          <USelect
            v-model="modelLanguage"
            :items="languageOptions"
            value-key="value"
            label-key="label"
            class="w-full"
          />
        </div>

        <div class="space-y-2">
          <p class="text-sm text-muted">
            {{ t('settings.theme') }}
          </p>
          <div class="grid w-full grid-cols-2 gap-2">
            <UButton
              class="flex-1 justify-center"
              :variant="currentTheme === 'light' ? 'solid' : 'outline'"
              @click="$emit('setTheme', 'light')"
            >
              {{ t('settings.light') }}
            </UButton>
            <UButton
              class="flex-1 justify-center"
              :variant="currentTheme === 'dark' ? 'solid' : 'outline'"
              @click="$emit('setTheme', 'dark')"
            >
              {{ t('settings.dark') }}
            </UButton>
          </div>
        </div>
      </div>
    </template>
    <template
      v-if="canLogout"
      #footer
    >
      <div class="flex w-full justify-end">
        <UButton

          color="neutral"
          variant="outline"
          icon="i-lucide-log-out"
          :label="t('buttons.logout')"
          @click="$emit('logout')"
        />
      </div>
    </template>
  </UModal>
</template>
