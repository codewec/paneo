<script setup lang="ts">
// Extracted modal component to keep workspace template focused on orchestration.
const props = defineProps<{
  open: boolean
  uploadTotalCount: number
  uploadSelectedCountLabel: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'uploadFilesChange': [event: Event]
  'uploadFoldersChange': [event: Event]
  'confirm': []
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
    :title="t('modal.upload')"
  >
    <template #body>
      <div class="space-y-4">
        <div class="space-y-1">
          <p class="text-sm text-muted">
            {{ t('fields.chooseFiles') }}
          </p>
          <UInput
            type="file"
            multiple
            @change="$emit('uploadFilesChange', $event)"
          />
        </div>
        <div class="space-y-1">
          <p class="text-sm text-muted">
            {{ t('fields.chooseFolders') }}
          </p>
          <UInput
            type="file"
            multiple
            directory
            webkitdirectory
            @change="$emit('uploadFoldersChange', $event)"
          />
        </div>
        <p class="text-xs text-muted">
          {{ uploadSelectedCountLabel }}
        </p>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end w-full gap-2">
        <UButton
          color="neutral"
          variant="outline"
          :label="t('buttons.cancel')"
          @click="modelOpen = false"
        />
        <UButton
          :label="t('buttons.upload')"
          icon="i-lucide-upload"
          :disabled="uploadTotalCount === 0"
          @click="$emit('confirm')"
        />
      </div>
    </template>
  </UModal>
</template>
