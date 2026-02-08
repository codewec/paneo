<script setup lang="ts">
const props = defineProps<{
  open: boolean
  name: string
  loading: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'update:name': [value: string]
  'confirm': []
  'cancel': []
}>()

const { t } = useI18n()
const inputRef = ref<{ $el?: HTMLElement } | null>(null)

const modelOpen = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value)
})

const modelName = computed({
  get: () => props.name,
  set: (value: string) => emit('update:name', value)
})

// Focus input every time the modal opens to preserve keyboard-first flow.
watch(modelOpen, (isOpen) => {
  if (!isOpen) {
    return
  }

  nextTick(() => {
    const input = inputRef.value?.$el?.querySelector('input') as HTMLInputElement | null
    input?.focus()
    input?.select()
  })
})
</script>

<template>
  <UModal
    v-model:open="modelOpen"
    :title="t('modal.rename')"
  >
    <template #body>
      <UInput
        ref="inputRef"
        v-model="modelName"
        class="w-full"
        size="xl"
        :placeholder="t('fields.newName')"
        @keydown.enter.prevent="$emit('confirm')"
      />
    </template>
    <template #footer>
      <div class="flex justify-end w-full gap-2">
        <UButton
          color="neutral"
          variant="outline"
          :label="t('buttons.cancel')"
          :disabled="loading"
          @click="$emit('cancel')"
        />
        <UButton
          :label="t('buttons.rename')"
          icon="i-lucide-pencil"
          :loading="loading"
          @click="$emit('confirm')"
        />
      </div>
    </template>
  </UModal>
</template>
