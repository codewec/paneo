<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import type { PanelEntry, PanelState } from '~/types/file-manager'

interface PathPart {
  label: string
  path: string
}

defineProps<{
  panel: PanelState
  activePanelId: 'left' | 'right'
  panelDragOver: boolean
  pathCanScrollLeft: boolean
  pathCanScrollRight: boolean
  pathParts: PathPart[]
  panelTitle: string
  canGoBack: boolean
  visibleEntryCount: number
  selectedMtime: string
  setPathScrollRef: (panelId: 'left' | 'right', el: Element | ComponentPublicInstance | null) => void
  updatePathScrollState: (panelId: 'left' | 'right') => void
  onPathWheel: (panelId: 'left' | 'right', event: WheelEvent) => void
  scrollPathBy: (panelId: 'left' | 'right', direction: 'left' | 'right') => void
  onSelectPanel: (panel: PanelState) => void
  onOpenSources: (panel: PanelState) => void
  onNavigateToPath: (panel: PanelState, path: string) => void
  onRefreshBothPanels: () => Promise<void> | void
  onMirrorFromOpposite: (panel: PanelState) => Promise<void> | void
  onGoBack: (panel: PanelState) => Promise<void> | void
  setPanelListRef: (panelId: 'left' | 'right', el: Element | ComponentPublicInstance | null) => void
  isSelected: (panel: PanelState, entry: PanelEntry) => boolean
  isMarked: (panel: PanelState, entry: PanelEntry) => boolean
  canStartPanelEntryDrag: (panel: PanelState, entry: PanelEntry) => boolean
  onEntryClick: (panel: PanelState, entry: PanelEntry, event?: MouseEvent) => Promise<void> | void
  onEntryDoubleClick: (panel: PanelState, entry: PanelEntry) => Promise<void> | void
  onEntryDragStart: (panel: PanelState, entry: PanelEntry, event: DragEvent) => void
  onEntryDragEnd: () => void
  formatSize: (bytes: number) => string
  formatDate: (value: string) => string
  formatItemsCount: (count: number) => string
  isEntryFavorite: (panel: PanelState, entry: PanelEntry) => boolean
  onFavoriteToggle: (panel: PanelState, entry: PanelEntry) => void
  onPanelDragEnter: (panel: PanelState, event: DragEvent) => void
  onPanelDragOver: (panel: PanelState, event: DragEvent) => void
  onPanelDragLeave: (panel: PanelState, event: DragEvent) => void
  onPanelDrop: (panel: PanelState, event: DragEvent) => Promise<void> | void
}>()

const { t } = useI18n()

// Keep icon decision centralized in the panel component for row rendering clarity.
function entryIcon(entry: PanelEntry) {
  if (entry.kind === 'root') {
    return 'i-lucide-hard-drive'
  }

  if (entry.kind === 'dir') {
    return 'i-lucide-folder'
  }

  return 'i-lucide-file'
}
</script>

<template>
  <div
    class="h-full min-h-0"
    @dragenter.stop="onPanelDragEnter(panel, $event)"
    @dragover.stop="onPanelDragOver(panel, $event)"
    @dragleave.stop="onPanelDragLeave(panel, $event)"
    @drop.stop="onPanelDrop(panel, $event)"
  >
    <UCard
      :class="[
        'flex h-full min-h-0 flex-col',
        activePanelId === panel.id ? 'ring ring-primary-400' : '',
        panelDragOver ? 'ring-2 ring-primary-500' : ''
      ]"
      :ui="{ header: 'p-2', body: 'min-h-0 flex-1 overflow-hidden p-2 flex flex-col', footer: 'p-2' }"
      @click="onSelectPanel(panel)"
    >
      <template #header>
        <div class="flex items-center justify-between gap-2">
          <div class="min-w-0 flex flex-1 items-center gap-1">
            <UButton
              icon="i-lucide-house"
              size="xs"
              color="neutral"
              variant="ghost"
              class="shrink-0 px-1"
              :title="t('panel.sources')"
              @click.stop="onOpenSources(panel)"
            />
            <div class="relative min-w-0 flex-1">
              <div
                v-if="pathCanScrollLeft"
                class="pointer-events-none absolute inset-y-0 left-0 z-10 w-5 bg-gradient-to-r from-default to-transparent"
              />
              <div
                v-if="pathCanScrollRight"
                class="pointer-events-none absolute inset-y-0 right-0 z-10 w-5 bg-gradient-to-l from-default to-transparent"
              />

              <div class="absolute inset-y-0 left-0 z-20 flex items-center">
                <UButton
                  v-if="pathCanScrollLeft"
                  icon="i-lucide-chevron-left"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  class="h-5 w-5 p-0"
                  :title="t('buttons.scrollLeft')"
                  @click.stop="scrollPathBy(panel.id, 'left')"
                />
              </div>

              <div class="absolute inset-y-0 right-0 z-20 flex items-center">
                <UButton
                  v-if="pathCanScrollRight"
                  icon="i-lucide-chevron-right"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  class="h-5 w-5 p-0"
                  :title="t('buttons.scrollRight')"
                  @click.stop="scrollPathBy(panel.id, 'right')"
                />
              </div>

              <div
                :ref="(el: Element | ComponentPublicInstance | null) => setPathScrollRef(panel.id, el)"
                class="paneo-hide-scrollbar min-w-0 h-6 overflow-x-auto whitespace-nowrap px-6"
                @scroll="updatePathScrollState(panel.id)"
                @wheel.prevent="onPathWheel(panel.id, $event)"
              >
                <span
                  v-if="panel.rootId"
                  class="inline-flex h-6 items-center text-muted"
                >/</span>
                <span
                  v-if="!panel.rootId"
                  class="inline-flex h-6 items-center px-1 text-sm font-medium text-muted"
                >
                  {{ panelTitle }}
                </span>
                <template v-else>
                  <template
                    v-for="(part, partIndex) in pathParts"
                    :key="`${part.path || 'root'}-${partIndex}`"
                  >
                    <UButton
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      class="shrink-0 px-1"
                      @click.stop="onNavigateToPath(panel, part.path)"
                    >
                      {{ part.label }}
                    </UButton>
                    <span
                      v-if="partIndex < pathParts.length - 1"
                      class="text-muted"
                    >/</span>
                  </template>
                </template>
              </div>
            </div>
          </div>
          <ClientOnly>
            <div class="flex items-center gap-1">
              <UButton
                icon="i-lucide-refresh-cw"
                size="xs"
                color="neutral"
                variant="ghost"
                :title="t('buttons.refresh')"
                @click.stop="onRefreshBothPanels"
              />
              <UButton
                :icon="panel.id === 'left' ? 'i-lucide-panel-right-open' : 'i-lucide-panel-left-open'"
                size="xs"
                color="neutral"
                variant="ghost"
                :title="panel.id === 'left' ? t('panel.mirrorRight') : t('panel.mirrorLeft')"
                @click.stop="onMirrorFromOpposite(panel)"
              />
              <UButton
                icon="i-lucide-history"
                size="xs"
                color="neutral"
                variant="ghost"
                :title="t('panel.back')"
                :disabled="!canGoBack"
                @click.stop="onGoBack(panel)"
              />
            </div>
            <template #fallback>
              <div class="h-6 w-24 shrink-0" />
            </template>
          </ClientOnly>
        </div>
      </template>

      <UAlert
        v-if="panel.error"
        class="mb-2"
        color="error"
        variant="subtle"
        :title="panel.error"
      />

      <div
        class="mb-2 rounded-md border border-dashed px-3 py-2 text-xs transition"
        :class="[
          panelDragOver && panel.rootId
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-default text-muted',
          !panel.rootId ? 'opacity-50' : ''
        ]"
      >
        {{ t('panel.dropUpload') }}
      </div>

      <div
        :ref="(el: Element | ComponentPublicInstance | null) => setPanelListRef(panel.id, el)"
        :class="[
          'min-h-0 flex-1 space-y-1 overflow-auto -mr-2 pr-2',
          activePanelId !== panel.id ? 'opacity-65' : ''
        ]"
      >
        <UButton
          v-for="entry in panel.entries"
          :key="entry.key"
          class="group w-full justify-start"
          :class="[
            isSelected(panel, entry) && isMarked(panel, entry) ? 'text-warning' : ''
          ]"
          :data-entry-key="entry.key"
          :color="isSelected(panel, entry)
            ? (activePanelId === panel.id ? 'primary' : 'neutral')
            : isMarked(panel, entry)
              ? 'warning'
              : 'neutral'"
          :variant="isSelected(panel, entry)
            ? (activePanelId === panel.id ? 'soft' : 'subtle')
            : isMarked(panel, entry)
              ? 'soft'
              : 'ghost'"
          :draggable="canStartPanelEntryDrag(panel, entry)"
          @click.stop="onEntryClick(panel, entry, $event)"
          @dblclick.stop="onEntryDoubleClick(panel, entry)"
          @dragstart.stop="onEntryDragStart(panel, entry, $event)"
          @dragend.stop="onEntryDragEnd"
        >
          <template #leading>
            <UIcon
              :name="entryIcon(entry)"
              class="size-4"
            />
          </template>

          <span class="min-w-0 flex-1 truncate text-left">{{ entry.name }}</span>

          <template #trailing>
            <div class="ml-auto flex shrink-0 items-center gap-2">
              <span class="text-xs text-muted">
                {{ entry.kind === 'file' ? formatSize(entry.size) : '' }}
              </span>
              <UIcon
                v-if="entry.kind === 'dir'"
                name="i-lucide-star"
                :class="[
                  'size-4 shrink-0 cursor-pointer transition-opacity',
                  isEntryFavorite(panel, entry)
                    ? 'opacity-100 text-warning'
                    : 'opacity-0 text-muted group-hover:opacity-100'
                ]"
                :title="isEntryFavorite(panel, entry) ? t('panel.removeFavorite') : t('panel.addFavorite')"
                @click.stop.prevent="onFavoriteToggle(panel, entry)"
              />
            </div>
          </template>
        </UButton>
      </div>

      <template #footer>
        <div class="text-xs text-muted grid grid-cols-3 items-center">
          <span class="text-left">{{ formatItemsCount(visibleEntryCount) }}</span>
          <span class="text-center">{{ panel.loading ? t('loading') : '' }}</span>
          <span class="text-right">{{ selectedMtime ? formatDate(selectedMtime) : '' }}</span>
        </div>
      </template>
    </UCard>
  </div>
</template>
