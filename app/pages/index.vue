<script setup lang="ts">
const LOCALE_STORAGE_KEY = 'ffile.locale'

const panels = useFileManagerPanels()
const { t, locale, setLocale } = useI18n()
const colorMode = useColorMode()

const settingsOpen = ref(false)

const {
  rootsLoading,
  globalError,
  activePanelId,
  leftPanel,
  rightPanel,
  activePanel,
  panelTitle,
  formatSize,
  formatDate,
  isSelected,
  selectedMtime,
  visibleEntryCount,
  formatItemsCount,
  setListRef,
  moveSelection,
  moveSelectionByPage,
  initialize,
  selectPanel,
  onEntryClick,
  openSelectedEntry,
  switchActivePanel
} = panels

const {
  viewerOpen,
  viewerTitle,
  viewerUrl,
  viewerIsImage,
  editorOpen,
  editorTitle,
  editorContent,
  editorSaving,
  createDirOpen,
  createDirName,
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
  openCreateDir,
  createDir
} = useFileManagerActions(panels)

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

useFileManagerHotkeys({
  onTab: switchActivePanel,
  onArrowDown: () => moveSelection(activePanel.value, 1),
  onArrowUp: () => moveSelection(activePanel.value, -1),
  onPageDown: () => moveSelectionByPage(activePanel.value, 1),
  onPageUp: () => moveSelectionByPage(activePanel.value, -1),
  onEnter: () => openSelectedEntry(activePanel.value),
  onF1: openSettings,
  onF3: openViewer,
  onF4: openEditor,
  onF5: () => copyOrMove('copy'),
  onF6: () => copyOrMove('move'),
  onF7: openCreateDir,
  onF8: removeSelected
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
                <div class="flex items-center gap-2">
                  <UBadge :color="activePanelId === panel.id ? 'primary' : 'neutral'" variant="soft">
                    {{ panel.id === 'left' ? t('panel.left') : t('panel.right') }}
                  </UBadge>
                  <span class="text-sm font-medium truncate">{{ panelTitle(panel) }}</span>
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
              class="h-full space-y-1 overflow-auto"
              :ref="(el) => setListRef(panel.id, el)"
            >
              <UButton
                v-for="entry in panel.entries"
                :key="entry.key"
                class="w-full justify-start"
                :data-entry-key="entry.key"
                :color="isSelected(panel, entry) ? 'primary' : 'neutral'"
                :variant="isSelected(panel, entry) ? 'soft' : 'ghost'"
                @click.stop="onEntryClick(panel, entry)"
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
          <UButton :label="t('hotkeys.f1Settings')" icon="i-lucide-settings" color="neutral" variant="outline" class="justify-center" @click="openSettings" />
          <UButton :label="t('hotkeys.f3View')" icon="i-lucide-eye" color="neutral" variant="outline" class="justify-center" :disabled="!canView" @click="openViewer" />
          <UButton :label="t('hotkeys.f4Edit')" icon="i-lucide-file-pen-line" color="neutral" variant="outline" class="justify-center" :disabled="!canEdit" @click="openEditor" />
          <UButton :label="t('hotkeys.f5Copy')" icon="i-lucide-copy" class="justify-center" :disabled="!canCopyOrMove" @click="copyOrMove('copy')" />
          <UButton :label="t('hotkeys.f6Move')" icon="i-lucide-move-right" color="neutral" class="justify-center" :disabled="!canCopyOrMove" @click="copyOrMove('move')" />
          <UButton :label="t('hotkeys.f7Folder')" icon="i-lucide-folder-plus" color="neutral" variant="outline" class="justify-center" :disabled="!canCreateDir" @click="openCreateDir" />
          <UButton :label="t('hotkeys.f8Delete')" icon="i-lucide-trash-2" color="error" variant="outline" class="justify-center" :disabled="!canDelete" @click="removeSelected" />
        </div>
      </UCard>
    </div>

    <UModal v-model:open="viewerOpen" :title="viewerTitle" :ui="{ content: 'max-w-4xl' }">
      <template #body>
        <template v-if="viewerIsImage">
          <img :src="viewerUrl" alt="preview" class="max-h-[75vh] w-full object-contain" />
        </template>
        <template v-else>
          <iframe :src="viewerUrl" class="h-[75vh] w-full rounded" />
        </template>
      </template>
    </UModal>

    <UModal v-model:open="editorOpen" :title="t('modal.editor', { name: editorTitle })" :ui="{ content: 'max-w-5xl' }">
      <template #body>
        <div class="space-y-3">
          <UTextarea v-model="editorContent" :rows="18" autoresize class="font-mono" />
          <div class="flex justify-end">
            <UButton :loading="editorSaving" :label="t('buttons.save')" icon="i-lucide-save" @click="saveEditor" />
          </div>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="createDirOpen" :title="t('modal.createFolder')">
      <template #body>
        <div class="space-y-3">
          <UInput v-model="createDirName" :placeholder="t('fields.folderName')" />
          <div class="flex justify-end">
            <UButton :label="t('buttons.create')" icon="i-lucide-folder-plus" @click="createDir" />
          </div>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="settingsOpen" :title="t('modal.settings')">
      <template #body>
        <div class="space-y-4">
          <div class="space-y-2">
            <p class="text-sm text-muted">{{ t('settings.language') }}</p>
            <div class="grid w-full grid-cols-2 gap-2">
              <UButton class="flex-1 justify-center" :variant="locale === 'ru' ? 'solid' : 'outline'" @click="setLanguage('ru')">
                {{ t('settings.russian') }}
              </UButton>
              <UButton class="flex-1 justify-center" :variant="locale === 'en' ? 'solid' : 'outline'" @click="setLanguage('en')">
                {{ t('settings.english') }}
              </UButton>
            </div>
          </div>

          <div class="space-y-2">
            <p class="text-sm text-muted">{{ t('settings.theme') }}</p>
            <div class="grid w-full grid-cols-2 gap-2">
              <UButton class="flex-1 justify-center" :variant="currentTheme === 'light' ? 'solid' : 'outline'" @click="setTheme('light')">
                {{ t('settings.light') }}
              </UButton>
              <UButton class="flex-1 justify-center" :variant="currentTheme === 'dark' ? 'solid' : 'outline'" @click="setTheme('dark')">
                {{ t('settings.dark') }}
              </UButton>
            </div>
          </div>
        </div>
      </template>
    </UModal>

    <div v-if="rootsLoading || leftPanel.loading || rightPanel.loading" class="fixed right-4 top-4">
      <UBadge color="neutral" variant="soft">
        {{ t('loading') }}
      </UBadge>
    </div>
  </div>
</template>
