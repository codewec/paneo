<script setup lang="ts">
defineProps<{
  disabled: {
    f2: boolean
    f3: boolean
    f4: boolean
    f5: boolean
    f6: boolean
    f7: boolean
    f8: boolean
    f9: boolean
    f10: boolean
  }
}>()

defineEmits<{
  settings: []
  favorites: []
  view: []
  edit: []
  copy: []
  rename: []
  create: []
  remove: []
  upload: []
  download: []
}>()

const { t } = useI18n()
</script>

<template>
  <UCard :ui="{ body: 'p-2' }">
    <ClientOnly>
      <div class="grid grid-cols-2 gap-2 md:grid-cols-10">
        <UButton
          :label="t('hotkeys.f1Settings')"
          icon="i-lucide-settings"
          color="neutral"
          variant="outline"
          class="justify-center"
          @click="$emit('settings')"
        />
        <UButton
          :label="t('hotkeys.f2Favorites')"
          icon="i-lucide-star"
          color="neutral"
          variant="outline"
          class="justify-center"
          :disabled="disabled.f2"
          @click="$emit('favorites')"
        />
        <UButton
          :label="t('hotkeys.f3View')"
          icon="i-lucide-eye"
          color="neutral"
          variant="outline"
          class="justify-center"
          :disabled="disabled.f3"
          @click="$emit('view')"
        />
        <UButton
          :label="t('hotkeys.f4Edit')"
          icon="i-lucide-file-pen-line"
          color="neutral"
          variant="outline"
          class="justify-center"
          :disabled="disabled.f4"
          @click="$emit('edit')"
        />
        <UButton
          :label="t('hotkeys.f5Copy')"
          icon="i-lucide-copy"
          color="neutral"
          variant="outline"
          class="justify-center"
          :disabled="disabled.f5"
          @click="$emit('copy')"
        />
        <UButton
          :label="t('hotkeys.f6Rename')"
          icon="i-lucide-pencil"
          color="neutral"
          variant="outline"
          class="justify-center"
          :disabled="disabled.f6"
          @click="$emit('rename')"
        />
        <UButton
          :label="t('hotkeys.f7Create')"
          icon="i-lucide-folder-plus"
          color="neutral"
          variant="outline"
          class="justify-center"
          :disabled="disabled.f7"
          @click="$emit('create')"
        />
        <UButton
          :label="t('hotkeys.f8Delete')"
          icon="i-lucide-trash-2"
          color="error"
          variant="outline"
          class="justify-center"
          :disabled="disabled.f8"
          @click="$emit('remove')"
        />
        <UButton
          :label="t('hotkeys.f9Upload')"
          icon="i-lucide-upload"
          color="neutral"
          variant="outline"
          class="justify-center"
          :disabled="disabled.f9"
          @click="$emit('upload')"
        />
        <UButton
          :label="t('hotkeys.f10Download')"
          icon="i-lucide-download"
          color="neutral"
          variant="outline"
          class="justify-center"
          :disabled="disabled.f10"
          @click="$emit('download')"
        />
      </div>
      <template #fallback>
        <div class="h-10" />
      </template>
    </ClientOnly>
  </UCard>
</template>
