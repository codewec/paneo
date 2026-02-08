<script setup lang="ts">
// Extracted modal component to keep workspace template focused on orchestration.
interface FavoriteListItem {
  rootId: string
  path: string
  fullPath: string
}

const props = defineProps<{
  open: boolean
  loading: boolean
  items: FavoriteListItem[]
  selectedIndex: number
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'update:selectedIndex': [value: number]
  'openItem': [item: FavoriteListItem]
  'removeItem': [item: FavoriteListItem]
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
    :title="t('modal.favorites')"
  >
    <template #body>
      <div class="space-y-3">
        <p
          v-if="loading"
          class="text-sm text-muted"
        >
          {{ t('loading') }}
        </p>
        <p
          v-else-if="!items.length"
          class="text-sm text-muted"
        >
          {{ t('favorites.empty') }}
        </p>
        <div
          v-else
          class="max-h-72 space-y-1 overflow-auto"
        >
          <div
            v-for="(item, index) in items"
            :key="item.rootId + ':' + item.path"
            :class="[
              'flex items-center gap-2 rounded border p-2 transition',
              index === selectedIndex
                ? 'border-primary bg-primary/10'
                : 'border-default'
            ]"
          >
            <UButton
              class="min-w-0 flex-1 justify-start"
              color="neutral"
              variant="ghost"
              :title="item.fullPath"
              @click="emit('update:selectedIndex', index); emit('openItem', item)"
            >
              <span class="truncate font-mono text-xs">{{ item.fullPath }}</span>
            </UButton>
            <UButton
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              :title="t('panel.removeFavorite')"
              @click="emit('removeItem', item)"
            />
          </div>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end w-full">
        <UButton
          color="neutral"
          variant="outline"
          :label="t('buttons.close')"
          @click="modelOpen = false"
        />
      </div>
    </template>
  </UModal>
</template>
