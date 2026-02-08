<script setup lang="ts">
// Extracted modal component to keep workspace template focused on orchestration.
const props = defineProps<{
  open: boolean
  isBulkDownload: boolean
  downloadTargetsLength: number
  downloadPrimaryName: string
  downloadTargetPaths: string[]
  archiveName: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'update:archiveName': [value: string]
  'confirm': []
}>()

const { t } = useI18n()

const modelOpen = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value)
})

const modelArchiveName = computed({
  get: () => props.archiveName,
  set: (value: string) => emit('update:archiveName', value)
})
</script>

<template>
  <UModal
    v-model:open="modelOpen"
    :title="t('modal.download')"
  >
    <template #body>
      <div class="space-y-3">
        <p class="text-sm text-muted">
          {{ isBulkDownload
            ? t('confirm.downloadMultiple', { count: downloadTargetsLength })
            : t('confirm.download', { name: downloadPrimaryName }) }}
        </p>
        <p
          v-if="isBulkDownload"
          class="text-xs text-muted"
        >
          {{ t('confirm.downloadArchiveHint') }}
        </p>
        <UInput
          v-if="isBulkDownload"
          v-model="modelArchiveName"
          class="w-full"
          :placeholder="t('fields.archiveName')"
        />
        <div class="max-h-48 overflow-auto rounded border border-default p-2">
          <p
            v-for="path in downloadTargetPaths"
            :key="path"
            class="font-mono text-xs break-all"
          >
            {{ path }}
          </p>
        </div>
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
          color="neutral"
          :label="t('buttons.download')"
          icon="i-lucide-download"
          @click="$emit('confirm')"
        />
      </div>
    </template>
  </UModal>
</template>
