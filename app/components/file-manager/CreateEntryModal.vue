<script setup lang="ts">
const props = defineProps<{
  open: boolean
  name: string
  asFile: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'update:name': [value: string]
  'update:asFile': [value: boolean]
  'confirm': []
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

const modelAsFile = computed({
  get: () => props.asFile,
  set: (value: boolean) => emit('update:asFile', value)
})

// Focus input every time the modal opens to support immediate typing.
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
    :title="t('modal.create')"
  >
    <template #body>
      <div class="space-y-4">
        <UInput
          ref="inputRef"
          v-model="modelName"
          class="w-full"
          size="xl"
          :placeholder="t('fields.name')"
          @keydown.enter.prevent="$emit('confirm')"
        />
        <USwitch
          v-model="modelAsFile"
          :label="t('fields.file')"
        />
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end w-full">
        <UButton
          :label="t('buttons.create')"
          icon="i-lucide-folder-plus"
          @click="$emit('confirm')"
        />
      </div>
    </template>
  </UModal>
</template>
