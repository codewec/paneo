<script setup lang="ts">
// Extracted modal component to keep workspace template focused on orchestration.
const props = defineProps<{
  open: boolean
  isBulkDelete: boolean
  deleteTargetsLength: number
  deletePrimaryName: string
  deleteTargetPaths: string[]
  loading: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
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
    :title="t('modal.delete')"
  >
    <template #body>
      <div class="space-y-3">
        <p class="text-sm text-muted">
          {{ isBulkDelete
            ? t('confirm.deleteMultiple', { count: deleteTargetsLength })
            : t('confirm.delete', { name: deletePrimaryName }) }}
        </p>
        <div class="max-h-48 overflow-auto rounded border border-default p-2">
          <p
            v-for="path in deleteTargetPaths"
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
          color="error"
          :loading="loading"
          :label="t('buttons.delete')"
          icon="i-lucide-trash-2"
          @click="$emit('confirm')"
        />
      </div>
    </template>
  </UModal>
</template>
