<script setup lang="ts">
// Extracted modal component to keep workspace template focused on orchestration.
const props = defineProps<{
  open: boolean
  submitting: boolean
  fromLabel: string
  toLabel: string
  overwriteExisting: boolean
  deleteSource: boolean
  deleteSourceDisabled: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'update:overwriteExisting': [value: boolean]
  'update:deleteSource': [value: boolean]
  'confirm': []
  'cancel': []
}>()

const { t } = useI18n()

const modelOpen = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value)
})

const modelOverwrite = computed({
  get: () => props.overwriteExisting,
  set: (value: boolean) => emit('update:overwriteExisting', value)
})

const modelDeleteSource = computed({
  get: () => props.deleteSource,
  set: (value: boolean) => emit('update:deleteSource', value)
})
</script>

<template>
  <UModal
    v-model:open="modelOpen"
    :title="t('modal.copyOrMove')"
    :dismissible="!submitting"
  >
    <template #body>
      <div class="space-y-4">
        <div class="space-y-1 text-sm">
          <p class="text-muted">
            {{ t('copy.from') }}
          </p>
          <p class="font-mono break-all">
            {{ fromLabel }}
          </p>
        </div>
        <div class="space-y-1 text-sm">
          <p class="text-muted">
            {{ t('copy.to') }}
          </p>
          <p class="font-mono break-all">
            {{ toLabel }}
          </p>
        </div>

        <USwitch
          v-model="modelOverwrite"
          :label="t('copy.overwriteExisting')"
          :disabled="submitting"
        />
        <USwitch
          v-model="modelDeleteSource"
          :label="t('copy.deleteSource')"
          :disabled="submitting || deleteSourceDisabled"
        />
        <UAlert
          v-if="deleteSourceDisabled"
          color="warning"
          variant="subtle"
          :title="t('copy.deleteSourceBlocked')"
        />
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end w-full gap-2">
        <UButton
          color="neutral"
          variant="outline"
          :label="t('buttons.cancel')"
          :disabled="submitting"
          @click="$emit('cancel')"
        />
        <UButton
          :label="t('buttons.copy')"
          icon="i-lucide-copy"
          :loading="submitting"
          @click="$emit('confirm')"
        />
      </div>
    </template>
  </UModal>
</template>
