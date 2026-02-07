<script setup lang="ts">
const LOCALE_STORAGE_KEY = 'ffile.locale'

const panels = useFileManagerPanels()
const { t, locale, setLocale } = useI18n()
const colorMode = useColorMode()

const settingsOpen = ref(false)
const createDirInputRef = ref<{ $el?: HTMLElement } | null>(null)
const renameInputRef = ref<{ $el?: HTMLElement } | null>(null)

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
  getSelectedIndex,
  setListRef,
  moveSelection,
  moveSelectionByPage,
  loadPanel,
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
  copyConfirmOpen,
  copyOverwriteExisting,
  copyDeleteSource,
  copyDeleteSourceDisabled,
  copySubmitting,
  copyProgressOpen,
  activeCopyTask,
  activeCopyProgressPercent,
  renameOpen,
  renameName,
  renameLoading,
  copyFromLabel,
  copyToLabel,
  deleteConfirmOpen,
  deleteTarget,
  deleteLoading,
  canView,
  canEdit,
  canCopy,
  canRename,
  canDelete,
  canCreateDir,
  openViewer,
  openEditor,
  saveEditor,
  openCopy,
  confirmCopy,
  cancelActiveCopyTask,
  minimizeActiveCopyTask,
  openRename,
  confirmRename,
  closeRename,
  closeCopyConfirm,
  removeSelected,
  confirmRemoveSelected,
  openCreateDir,
  createDir
} = useFileManagerActions(panels)

const actionContext = computed(() => {
  return {
    canView: canView.value,
    canEdit: canEdit.value,
    canCopy: canCopy.value,
    canRename: canRename.value,
    canCreateDir: canCreateDir.value,
    canDelete: canDelete.value
  }
})
const copyProgressStatusLabel = computed(() => {
  const status = activeCopyTask.value?.status
  if (!status) {
    return t('copy.status.running')
  }

  return t(`copy.status.${status}`)
})
const copyProgressHeader = computed(() => {
  const percent = activeCopyProgressPercent.value
  if (percent === null) {
    return copyProgressStatusLabel.value
  }

  return `${copyProgressStatusLabel.value} · ${percent}%`
})

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

async function refreshBothPanels() {
  const leftIndex = getSelectedIndex(leftPanel)
  const rightIndex = getSelectedIndex(rightPanel)

  await Promise.all([
    loadPanel(leftPanel, { preferredSelectedIndex: leftIndex >= 0 ? leftIndex : null }),
    loadPanel(rightPanel, { preferredSelectedIndex: rightIndex >= 0 ? rightIndex : null })
  ])
}

function isModalOpen() {
  return viewerOpen.value
    || editorOpen.value
    || createDirOpen.value
    || renameOpen.value
    || copyConfirmOpen.value
    || copyProgressOpen.value
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

function focusRenameInput() {
  nextTick(() => {
    const input = renameInputRef.value?.$el?.querySelector('input') as HTMLInputElement | null
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

async function handleCopyConfirmEnter(event: KeyboardEvent) {
  if (!copyConfirmOpen.value || copySubmitting.value) {
    return
  }

  if (event.key !== 'Enter') {
    return
  }

  event.preventDefault()
  event.stopPropagation()
  await confirmCopy()
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
  onF3: () => actionContext.value.canView ? openViewer() : Promise.resolve(),
  onF4: () => actionContext.value.canEdit ? openEditor() : Promise.resolve(),
  onF5: () => actionContext.value.canCopy ? Promise.resolve(openCopy()) : Promise.resolve(),
  onF6: () => actionContext.value.canRename ? Promise.resolve(openRename()) : Promise.resolve(),
  onF7: () => {
    if (actionContext.value.canCreateDir) {
      openCreateDir()
    }
  },
  onF8: () => actionContext.value.canDelete ? removeSelected() : Promise.resolve()
})

watch(createDirOpen, (isOpen) => {
  if (isOpen) {
    focusCreateDirInput()
  }
})

watch(renameOpen, (isOpen) => {
  if (isOpen) {
    focusRenameInput()
  }
})

watch(deleteConfirmOpen, (isOpen) => {
  if (isOpen) {
    window.addEventListener('keydown', handleDeleteConfirmEnter, true)
    return
  }

  window.removeEventListener('keydown', handleDeleteConfirmEnter, true)
})

watch(copyConfirmOpen, (isOpen) => {
  if (isOpen) {
    window.addEventListener('keydown', handleCopyConfirmEnter, true)
    return
  }

  window.removeEventListener('keydown', handleCopyConfirmEnter, true)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleDeleteConfirmEnter, true)
  window.removeEventListener('keydown', handleCopyConfirmEnter, true)
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
                    icon="i-lucide-refresh-cw"
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    :title="t('buttons.refresh')"
                    @click.stop="refreshBothPanels"
                  />
                  <UButton
                    :icon="panel.id === 'left' ? 'i-lucide-panel-right-open' : 'i-lucide-panel-left-open'"
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    :title="panel.id === 'left' ? t('panel.mirrorRight') : t('panel.mirrorLeft')"
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
              :class="[
                'h-full space-y-1 overflow-auto',
                activePanelId !== panel.id ? 'opacity-65' : ''
              ]"
            >
              <UButton
                v-for="entry in panel.entries"
                :key="entry.key"
                class="w-full justify-start"
                :data-entry-key="entry.key"
                :color="isSelected(panel, entry)
                  ? (activePanelId === panel.id ? 'primary' : 'neutral')
                  : 'neutral'"
                :variant="isSelected(panel, entry)
                  ? (activePanelId === panel.id ? 'soft' : 'subtle')
                  : 'ghost'"
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
            :disabled="!actionContext.canView"
            @click="openViewer"
          />
          <UButton
            :label="t('hotkeys.f4Edit')"
            icon="i-lucide-file-pen-line"
            color="neutral"
            variant="outline"
            class="justify-center"
            :disabled="!actionContext.canEdit"
            @click="openEditor"
          />
          <UButton
            :label="t('hotkeys.f5Copy')"
            icon="i-lucide-copy"
            color="neutral"
            variant="outline"
            class="justify-center"
            :disabled="!actionContext.canCopy"
            @click="openCopy"
          />
          <UButton
            :label="t('hotkeys.f6Rename')"
            icon="i-lucide-pencil"
            color="neutral"
            variant="outline"
            class="justify-center"
            :disabled="!actionContext.canRename"
            @click="openRename"
          />
          <UButton
            :label="t('hotkeys.f7Folder')"
            icon="i-lucide-folder-plus"
            color="neutral"
            variant="outline"
            class="justify-center"
            :disabled="!actionContext.canCreateDir"
            @click="openCreateDir"
          />
          <UButton
            :label="t('hotkeys.f8Delete')"
            icon="i-lucide-trash-2"
            color="error"
            variant="outline"
            class="justify-center"
            :disabled="!actionContext.canDelete"
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
      v-model:open="copyConfirmOpen"
      :title="t('modal.copyOrMove')"
      :dismissible="!copySubmitting"
    >
      <template #body>
        <div class="space-y-4">
          <div class="space-y-1 text-sm">
            <p class="text-muted">
              {{ t('copy.from') }}
            </p>
            <p class="font-mono break-all">
              {{ copyFromLabel }}
            </p>
          </div>
          <div class="space-y-1 text-sm">
            <p class="text-muted">
              {{ t('copy.to') }}
            </p>
            <p class="font-mono break-all">
              {{ copyToLabel }}
            </p>
          </div>

          <USwitch
            v-model="copyOverwriteExisting"
            :label="t('copy.overwriteExisting')"
            :disabled="copySubmitting"
          />
          <USwitch
            v-model="copyDeleteSource"
            :label="t('copy.deleteSource')"
            :disabled="copySubmitting || copyDeleteSourceDisabled"
          />
          <UAlert
            v-if="copyDeleteSourceDisabled"
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
            :disabled="copySubmitting"
            @click="closeCopyConfirm"
          />
          <UButton
            :label="t('buttons.copy')"
            icon="i-lucide-copy"
            :loading="copySubmitting"
            @click="confirmCopy"
          />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="renameOpen"
      :title="t('modal.rename')"
    >
      <template #body>
        <UInput
          ref="renameInputRef"
          v-model="renameName"
          class="w-full"
          size="xl"
          :placeholder="t('fields.newName')"
          @keydown.enter.prevent="confirmRename"
        />
      </template>
      <template #footer>
        <div class="flex justify-end w-full gap-2">
          <UButton
            color="neutral"
            variant="outline"
            :label="t('buttons.cancel')"
            :disabled="renameLoading"
            @click="closeRename"
          />
          <UButton
            :label="t('buttons.rename')"
            icon="i-lucide-pencil"
            :loading="renameLoading"
            @click="confirmRename"
          />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="copyProgressOpen"
      :title="`${t('modal.copyProgress')} · ${copyProgressHeader}`"
      :dismissible="false"
      :close="false"
    >
      <template #body>
        <div
          v-if="activeCopyTask"
          class="space-y-4"
        >
          <div class="space-y-1 text-sm">
            <p class="text-muted">
              {{ t('copy.from') }}
            </p>
            <p class="font-mono break-all">
              {{ activeCopyTask.fromLabel }}
            </p>
          </div>
          <div class="space-y-1 text-sm">
            <p class="text-muted">
              {{ t('copy.to') }}
            </p>
            <p class="font-mono break-all">
              {{ activeCopyTask.toLabel }}
            </p>
          </div>

          <UProgress :model-value="activeCopyProgressPercent" />
          <div class="text-xs text-muted space-y-1">
            <p>{{ activeCopyTask.currentFile || t('copy.preparing') }}</p>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end w-full gap-2">
          <UButton
            color="warning"
            variant="outline"
            :label="t('buttons.cancelCopy')"
            icon="i-lucide-ban"
            :disabled="!activeCopyTask || activeCopyTask.status !== 'running'"
            @click="cancelActiveCopyTask"
          />
          <UButton
            color="neutral"
            variant="outline"
            :label="t('buttons.minimize')"
            icon="i-lucide-minimize-2"
            @click="minimizeActiveCopyTask"
          />
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
