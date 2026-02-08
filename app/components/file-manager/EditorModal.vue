<script setup lang="ts">
const props = defineProps<{
  open: boolean
  editorTitle: string
  content: string
  saving: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'update:content': [value: string]
  'save': []
}>()

const { t } = useI18n()

const modelOpen = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value)
})

const modelContent = computed({
  get: () => props.content,
  set: (value: string) => emit('update:content', value)
})
</script>

<template>
  <UModal
    v-model:open="modelOpen"
    :title="t('modal.editor', { name: editorTitle })"
    :ui="{
      content: 'max-w-5xl h-[70vh] overflow-hidden flex flex-col',
      body: 'flex-1 min-h-0 overflow-hidden p-4'
    }"
  >
    <template #body>
      <div class="flex h-full min-h-0 flex-col gap-3">
        <UTextarea
          v-model="modelContent"
          class="flex-1 min-h-0 font-mono"
          :ui="{ root: 'h-full', base: 'h-full resize-none overflow-auto' }"
        />
        <div class="shrink-0 flex justify-end">
          <UButton
            :loading="saving"
            :label="t('buttons.save')"
            icon="i-lucide-save"
            @click="$emit('save')"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
