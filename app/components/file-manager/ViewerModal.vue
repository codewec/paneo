<script setup lang="ts">
type ViewerMode = 'image' | 'video' | 'audio' | 'pdf' | 'text'

const props = defineProps<{
  open: boolean
  title: string
  url: string
  mode: ViewerMode
  textContent: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const modelOpen = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value)
})
</script>

<template>
  <UModal
    v-model:open="modelOpen"
    :title="title"
    :ui="{ content: 'max-w-4xl' }"
  >
    <template #body>
      <template v-if="mode === 'image'">
        <img
          :src="url"
          alt="preview"
          class="max-h-[75vh] w-full object-contain"
        >
      </template>
      <template v-else-if="mode === 'video'">
        <video
          :src="url"
          controls
          class="max-h-[75vh] w-full"
        />
      </template>
      <template v-else-if="mode === 'audio'">
        <audio
          :src="url"
          controls
          class="w-full"
        />
      </template>
      <template v-else-if="mode === 'pdf'">
        <iframe
          :src="url"
          class="h-[75vh] w-full rounded"
        />
      </template>
      <template v-else>
        <pre class="h-[75vh] w-full overflow-auto rounded border border-default p-3 font-mono text-xs whitespace-pre-wrap">{{ textContent }}</pre>
      </template>
    </template>
  </UModal>
</template>
