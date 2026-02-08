<script setup lang="ts">
// Extracted modal component to keep workspace template focused on orchestration.
interface UploadTaskLike {
  toLabel: string
  currentFile: string
  status: 'running' | 'completed' | 'failed' | 'canceled'
}

const props = defineProps<{
  open: boolean
  title: string
  activeTask: UploadTaskLike | null
  progressPercent: number | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'cancel': []
  'minimize': []
}>()

const { t } = useI18n()

const modelOpen = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value)
})
</script>

<template>
  <UModal
    v-model:open="modelOpen"
    :title="title"
    :dismissible="false"
    :close="false"
  >
    <template #body>
      <div
        v-if="activeTask"
        class="space-y-4"
      >
        <div class="space-y-1 text-sm">
          <p class="text-muted">
            {{ t('upload.to') }}
          </p>
          <p class="font-mono break-all">
            {{ activeTask.toLabel }}
          </p>
        </div>

        <UProgress :model-value="progressPercent" />
        <div class="text-xs text-muted space-y-1">
          <p
            v-if="activeTask.currentFile"
            class="font-mono paneo-tail-ellipsis"
            :title="activeTask.currentFile"
          >
            {{ activeTask.currentFile }}
          </p>
          <p v-else>
            {{ t('upload.preparing') }}
          </p>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end w-full gap-2">
        <UButton
          color="warning"
          variant="outline"
          :label="t('buttons.cancelUpload')"
          icon="i-lucide-ban"
          :disabled="!activeTask || activeTask.status !== 'running'"
          @click="$emit('cancel')"
        />
        <UButton
          color="neutral"
          variant="outline"
          :label="t('buttons.minimize')"
          icon="i-lucide-minimize-2"
          @click="$emit('minimize')"
        />
      </div>
    </template>
  </UModal>
</template>
