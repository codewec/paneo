<script setup lang="ts">
const LOCALE_STORAGE_KEY = 'ffile.locale'

const panels = useFileManagerPanels()
const { t, locale, setLocale } = useI18n()
const colorMode = useColorMode()

const settingsOpen = ref(false)
const createDirInputRef = ref<{ $el?: HTMLElement } | null>(null)

const {
  rootsLoading,
  globalError,
  activePanelId,
  leftPanel,
  rightPanel,
  activePanel,
  panelTitle,
  pathParts,
  formatSize,
  formatDate,
  isSelected,
  selectedMtime,
  visibleEntryCount,
  formatItemsCount,
  canGoBack,
  setListRef,
  moveSelection,
  moveSelectionByPage,
  initialize,
  selectPanel,
  openSources,
  navigateToPath,
  onEntryClick,
  onEntryDoubleClick,
  goBack,
  mirrorFromOpposite,
  openSelectedEntry,
  switchActivePanel
} = panels

const {
  viewerOpen,
  viewerTitle,
  viewerUrl,
  viewerMode,
  editorOpen,
  editorTitle,
  editorContent,
  editorSaving,
  createDirOpen,
  createDirName,
  deleteConfirmOpen,
  deleteTarget,
  deleteLoading,
  canView,
  canEdit,
  canCopyOrMove,
  canDelete,
  canCreateDir,
  openViewer,
  openEditor,
  saveEditor,
  copyOrMove,
  removeSelected,
  confirmRemoveSelected,
  openCreateDir,
  createDir
} = useFileManagerActions(panels)

const hasActionContext = computed(() => !!activePanel.value.rootId)

const currentTheme = computed<'light' | 'dark'>({
  get: () => colorMode.preference === 'dark' ? 'dark' : 'light',
  set: (value) => {
    colorMode.preference = value
  }
})

function openSettings() {
  settingsOpen.value = true
}

function setTheme(value: 'light' | 'dark') {
  currentTheme.value = value
}

function setLanguage(value: 'ru' | 'en') {
  if (locale.value === value) {
    return
  }

  void setLocale(value)
}

function isModalOpen() {
  return viewerOpen.value
    || editorOpen.value
    || createDirOpen.value
    || deleteConfirmOpen.value
    || settingsOpen.value
}

function focusCreateDirInput() {
  nextTick(() => {
    const input = createDirInputRef.value?.$el?.querySelector('input') as HTMLInputElement | null
    input?.focus()
    input?.select()
  })
}

async function handleDeleteConfirmEnter(event: KeyboardEvent) {
  if (!deleteConfirmOpen.value || deleteLoading.value) {
    return
  }

  if (event.key !== 'Enter') {
    return
  }

  event.preventDefault()
  event.stopPropagation()
  await confirmRemoveSelected()
}

useFileManagerHotkeys({
  isEnabled: () => !isModalOpen(),
  onTab: switchActivePanel,
  onArrowDown: () => moveSelection(activePanel.value, 1),
  onArrowUp: () => moveSelection(activePanel.value, -1),
  onPageDown: () => moveSelectionByPage(activePanel.value, 1),
  onPageUp: () => moveSelectionByPage(activePanel.value, -1),
  onEnter: () => openSelectedEntry(activePanel.value),
  onF1: openSettings,
  onF3: () => hasActionContext.value ? openViewer() : Promise.resolve(),
  onF4: () => hasActionContext.value ? openEditor() : Promise.resolve(),
  onF5: () => hasActionContext.value ? copyOrMove('copy') : Promise.resolve(),
  onF6: () => hasActionContext.value ? copyOrMove('move') : Promise.resolve(),
  onF7: () => {
    if (hasActionContext.value) {
      openCreateDir()
    }
  },
  onF8: () => hasActionContext.value ? removeSelected() : Promise.resolve()
})

watch(createDirOpen, (isOpen) => {
  if (isOpen) {
    focusCreateDirInput()
  }
})

watch(deleteConfirmOpen, (isOpen) => {
  if (isOpen) {
    window.addEventListener('keydown', handleDeleteConfirmEnter, true)
    return
  }

  window.removeEventListener('keydown', handleDeleteConfirmEnter, true)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleDeleteConfirmEnter, true)
})

onMounted(() => {
  const savedLocale = localStorage.getItem(LOCALE_STORAGE_KEY)
  if ((savedLocale === 'ru' || savedLocale === 'en') && savedLocale !== locale.value) {
    void setLocale(savedLocale)
  }
})

watch(locale, (value) => {
  if (import.meta.client) {
    localStorage.setItem(LOCALE_STORAGE_KEY, value)
  }
})

await initialize()
</script>

<template>
  <div class="h-[100dvh] w-full overflow-hidden bg-default p-2">
    <div class="flex h-full flex-col gap-2">
      <UAlert
        v-if="globalError"
        color="error"
        variant="subtle"
        :title="globalError"
      />

      <div class="min-h-0 flex-1">
        <div class="grid h-full gap-2 lg:grid-cols-2">
          <UCard
            v-for="panel in [leftPanel, rightPanel]"
            :key="panel.id"
            :class="[
              'flex h-full min-h-0 flex-col',
              activePanelId === panel.id ? 'ring ring-primary-400' : ''
            ]"
            :ui="{ header: 'p-2', body: 'min-h-0 flex-1 overflow-hidden p-2', footer: 'p-2' }"
            @click="selectPanel(panel)"
          >
            <template #header>
              <div class="flex items-center justify-between gap-2">
                <div class="min-w-0 flex items-center gap-1 overflow-x-auto whitespace-nowrap">
                  <UButton
                    icon="i-lucide-house"
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    class="shrink-0 px-1"
                    :title="t('panel.sources')"
                    @click.stop="openSources(panel)"
                  />
                  <span
                    v-if="panel.rootId"
                    class="text-muted"
                  >/</span>
                  <span
                    v-if="!panel.rootId"
                    class="text-sm font-medium text-muted"
                  >
                    {{ panelTitle(panel) }}
                  </span>
                  <template v-else>
                    <template
                      v-for="(part, partIndex) in pathParts(panel)"
                      :key="`${part.path || 'root'}-${partIndex}`"
                    >
                      <UButton
                        size="xs"
                        color="neutral"
                        variant="ghost"
                        class="shrink-0 px-1"
                        @click.stop="navigateToPath(panel, part.path)"
                      >
                        {{ part.label }}
                      </UButton>
                      <span
                        v-if="partIndex < pathParts(panel).length - 1"
                        class="text-muted"
                      >/</span>
                    </template>
                  </template>
                </div>
                <div class="flex items-center gap-1">
                  <UButton
                    icon="i-lucide-copy"
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    :title="t('panel.mirror')"
                    @click.stop="mirrorFromOpposite(panel)"
                  />
                  <UButton
                    icon="i-lucide-history"
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    :title="t('panel.back')"
                    :disabled="!canGoBack(panel)"
                    @click.stop="goBack(panel)"
                  />
                </div>
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
              :ref="(el) => setListRef(panel.id, el)"
              class="h-full space-y-1 overflow-auto"
            >
              <UButton
                v-for="entry in panel.entries"
                :key="entry.key"
                class="w-full justify-start"
                :data-entry-key="entry.key"
                :color="isSelected(panel, entry) ? 'primary' : 'neutral'"
                :variant="isSelected(panel, entry) ? 'soft' : 'ghost'"
                @click.stop="onEntryClick(panel, entry)"
                @dblclick.stop="onEntryDoubleClick(panel, entry)"
              >
                <template #leading>
                  <UIcon
                    :name="entry.kind === 'root' ? 'i-lucide-hard-drive' : entry.kind === 'dir' ? 'i-lucide-folder' : 'i-lucide-file'"
                    class="size-4"
                  />
                </template>

                <span class="truncate">{{ entry.name }}</span>

                <template #trailing>
                  <span class="text-xs text-muted">
                    {{ entry.kind === 'file' ? formatSize(entry.size) : '' }}
                  </span>
                </template>
              </UButton>
            </div>

            <template #footer>
              <div class="text-xs text-muted flex items-center justify-between">
                <span>{{ formatItemsCount(visibleEntryCount(panel)) }}</span>
                <span>{{ selectedMtime(panel) ? formatDate(selectedMtime(panel)) : '' }}</span>
              </div>
            </template>
          </UCard>
        </div>
      </div>

      <UCard :ui="{ body: 'p-2' }">
        <div class="grid grid-cols-2 gap-2 md:grid-cols-7">
          <UButton
            :label="t('hotkeys.f1Settings')"
            icon="i-lucide-settings"
            color="neutral"
            variant="outline"
            class="justify-center"
            @click="openSettings"
          />
          <UButton
            :label="t('hotkeys.f3View')"
            icon="i-lucide-eye"
            color="neutral"
            variant="outline"
            class="justify-center"
            :disabled="!hasActionContext || !canView"
            @click="openViewer"
          />
          <UButton
            :label="t('hotkeys.f4Edit')"
            icon="i-lucide-file-pen-line"
            color="neutral"
            variant="outline"
            class="justify-center"
            :disabled="!hasActionContext || !canEdit"
            @click="openEditor"
          />
          <UButton
            :label="t('hotkeys.f5Copy')"
            icon="i-lucide-copy"
            class="justify-center"
            :disabled="!hasActionContext || !canCopyOrMove"
            @click="copyOrMove('copy')"
          />
          <UButton
            :label="t('hotkeys.f6Move')"
            icon="i-lucide-move-right"
            color="neutral"
            class="justify-center"
            :disabled="!hasActionContext || !canCopyOrMove"
            @click="copyOrMove('move')"
          />
          <UButton
            :label="t('hotkeys.f7Folder')"
            icon="i-lucide-folder-plus"
            color="neutral"
            variant="outline"
            class="justify-center"
            :disabled="!hasActionContext || !canCreateDir"
            @click="openCreateDir"
          />
          <UButton
            :label="t('hotkeys.f8Delete')"
            icon="i-lucide-trash-2"
            color="error"
            variant="outline"
            class="justify-center"
            :disabled="!hasActionContext || !canDelete"
            @click="removeSelected"
          />
        </div>
      </UCard>
    </div>

    <UModal
      v-model:open="viewerOpen"
      :title="viewerTitle"
      :ui="{ content: 'max-w-4xl' }"
    >
      <template #body>
        <template v-if="viewerMode === 'image'">
          <img
            :src="viewerUrl"
            alt="preview"
            class="max-h-[75vh] w-full object-contain"
          >
        </template>
        <template v-else-if="viewerMode === 'video'">
          <video
            :src="viewerUrl"
            controls
            class="max-h-[75vh] w-full"
          />
        </template>
        <template v-else-if="viewerMode === 'audio'">
          <audio
            :src="viewerUrl"
            controls
            class="w-full"
          />
        </template>
        <template v-else>
          <iframe
            :src="viewerUrl"
            class="h-[75vh] w-full rounded"
          />
        </template>
      </template>
    </UModal>

    <UModal
      v-model:open="editorOpen"
      :title="t('modal.editor', { name: editorTitle })"
      :ui="{
        content: 'max-w-5xl h-[70vh] overflow-hidden flex flex-col',
        body: 'flex-1 min-h-0 overflow-hidden p-4'
      }"
    >
      <template #body>
        <div class="flex h-full min-h-0 flex-col gap-3">
          <UTextarea
            v-model="editorContent"
            class="flex-1 min-h-0 font-mono"
            :ui="{ root: 'h-full', base: 'h-full resize-none overflow-auto' }"
          />
          <div class="shrink-0 flex justify-end">
            <UButton
              :loading="editorSaving"
              :label="t('buttons.save')"
              icon="i-lucide-save"
              @click="saveEditor"
            />
          </div>
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="createDirOpen"
      :title="t('modal.createFolder')"
    >
      <template #body>
        <UInput
          ref="createDirInputRef"
          v-model="createDirName"
          class="w-full"
          size="xl"
          :placeholder="t('fields.folderName')"
          @keydown.enter.prevent="createDir"
        />
      </template>
      <template #footer>
        <div class="flex justify-end w-full">
          <UButton
            :label="t('buttons.create')"
            icon="i-lucide-folder-plus"
            @click="createDir"
          />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="deleteConfirmOpen"
      :title="t('modal.delete')"
    >
      <template #body>
        <p class="text-sm text-muted">
          {{ t('confirm.delete', { name: deleteTarget?.name || '' }) }}
        </p>
      </template>
      <template #footer>
        <div class="flex justify-end w-full gap-2">
          <UButton
            color="neutral"
            variant="outline"
            :label="t('buttons.cancel')"
            @click="deleteConfirmOpen = false"
          />
          <UButton
            color="error"
            :loading="deleteLoading"
            :label="t('buttons.delete')"
            icon="i-lucide-trash-2"
            @click="confirmRemoveSelected"
          />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="settingsOpen"
      :title="t('modal.settings')"
    >
      <template #body>
        <div class="space-y-4">
          <div class="space-y-2">
            <p class="text-sm text-muted">
              {{ t('settings.language') }}
            </p>
            <div class="grid w-full grid-cols-2 gap-2">
              <UButton
                class="flex-1 justify-center"
                :variant="locale === 'ru' ? 'solid' : 'outline'"
                @click="setLanguage('ru')"
              >
                {{ t('settings.russian') }}
              </UButton>
              <UButton
                class="flex-1 justify-center"
                :variant="locale === 'en' ? 'solid' : 'outline'"
                @click="setLanguage('en')"
              >
                {{ t('settings.english') }}
              </UButton>
            </div>
          </div>

          <div class="space-y-2">
            <p class="text-sm text-muted">
              {{ t('settings.theme') }}
            </p>
            <div class="grid w-full grid-cols-2 gap-2">
              <UButton
                class="flex-1 justify-center"
                :variant="currentTheme === 'light' ? 'solid' : 'outline'"
                @click="setTheme('light')"
              >
                {{ t('settings.light') }}
              </UButton>
              <UButton
                class="flex-1 justify-center"
                :variant="currentTheme === 'dark' ? 'solid' : 'outline'"
                @click="setTheme('dark')"
              >
                {{ t('settings.dark') }}
              </UButton>
            </div>
          </div>
        </div>
      </template>
    </UModal>

    <div
      v-if="rootsLoading || leftPanel.loading || rightPanel.loading"
      class="fixed right-4 top-4"
    >
      <UBadge
        color="neutral"
        variant="soft"
      >
        {{ t('loading') }}
      </UBadge>
    </div>
  </div>
</template>
