<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'

const LOCALE_COOKIE_KEY = 'paneo.locale'
const SUPPORTED_LOCALES = ['ru', 'en', 'zh-Hant', 'de', 'es'] as const
type LocaleCode = typeof SUPPORTED_LOCALES[number]

const panels = useFileManagerPanels()
const api = useFileManagerApi()
const { t, locale, setLocale } = useI18n()
const colorMode = useColorMode()
const localeCookie = useCookie<string | null>(LOCALE_COOKIE_KEY, {
  secure: false,
  sameSite: 'lax',
  path: '/'
})
const savedLocale = localeCookie.value
if (savedLocale && SUPPORTED_LOCALES.includes(savedLocale as LocaleCode) && savedLocale !== locale.value) {
  await setLocale(savedLocale as LocaleCode)
}

const settingsOpen = ref(false)
const uploadOpen = ref(false)
const uploadFiles = ref<File[]>([])
const uploadFolderFiles = ref<File[]>([])
const isClientMounted = ref(false)
const createDirInputRef = ref<{ $el?: HTMLElement } | null>(null)
const renameInputRef = ref<{ $el?: HTMLElement } | null>(null)
const toast = useAppToast()
const panelDragOver = reactive<Record<'left' | 'right', boolean>>({
  left: false,
  right: false
})
const panelDragDepth = reactive<Record<'left' | 'right', number>>({
  left: 0,
  right: 0
})

type DndEntry = FileSystemEntry
type DndFileEntry = FileSystemFileEntry
type DndDirectoryReader = FileSystemDirectoryReader
type DndDirectoryEntry = FileSystemDirectoryEntry

function isDndEntry(entry: FileSystemEntry | null): entry is DndEntry {
  return entry !== null
}

function setPanelListRef(panelId: 'left' | 'right', el: Element | ComponentPublicInstance | null) {
  const element = el && '$el' in el
    ? ((el.$el as Element | undefined) ?? null)
    : el

  setListRef(panelId, element)
}

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
  isMarked,
  selectedMtime,
  visibleEntryCount,
  formatItemsCount,
  canGoBack,
  getSelectedIndex,
  setListRef,
  focusSelectedEntry,
  moveSelection,
  moveSelectionByPage,
  toggleMarkAndMoveNext,
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
  createAsFile,
  copyConfirmOpen,
  copyOverwriteExisting,
  copyDeleteSource,
  copyDeleteSourceDisabled,
  copySubmitting,
  copyProgressOpen,
  activeCopyTask,
  activeCopyProgressPercent,
  uploadProgressOpen,
  activeUploadTask,
  activeUploadProgressPercent,
  renameOpen,
  renameName,
  renameLoading,
  copyFromLabel,
  copyToLabel,
  deleteConfirmOpen,
  deleteTargets,
  isBulkDelete,
  deletePrimaryName,
  deleteLoading,
  canEdit,
  canCopy,
  canRename,
  canDelete,
  canCreateDir,
  canUpload,
  openViewer,
  openEditor,
  saveEditor,
  openCopy,
  confirmCopy,
  cancelActiveCopyTask,
  minimizeActiveCopyTask,
  cancelActiveUploadTask,
  minimizeActiveUploadTask,
  openRename,
  confirmRename,
  closeRename,
  closeCopyConfirm,
  removeSelected,
  confirmRemoveSelected,
  openCreateDir,
  createDir,
  uploadSelected,
  startUploadForPanel
} = useFileManagerActions(panels)

const activePanelSelectedEntry = computed(() => {
  const panel = activePanel.value
  if (!panel.selectedKey) {
    return null
  }

  return panel.entries.find(entry => entry.key === panel.selectedKey) || null
})

const actionEntriesCount = computed(() => panels.getActionEntries(activePanel.value).length)
const isMultiActionSelection = computed(() => actionEntriesCount.value > 1)
const selectedKind = computed(() => activePanelSelectedEntry.value?.kind || null)
const canUseFileActions = computed(() => selectedKind.value === 'file')
const canUseEntryActions = computed(() => selectedKind.value === 'file' || selectedKind.value === 'dir')

const canUseF3 = computed(() => isClientMounted.value && !isMultiActionSelection.value && canUseFileActions.value)
const canUseF2 = computed(() => isClientMounted.value && !!activePanel.value.rootId && canUpload.value)
const canUseF4 = computed(() => isClientMounted.value && !isMultiActionSelection.value && canUseFileActions.value && canEdit.value)
const canUseF5 = computed(() => isClientMounted.value && canUseEntryActions.value && canCopy.value)
const canUseF6 = computed(() => isClientMounted.value && !isMultiActionSelection.value && canUseEntryActions.value && canRename.value)
const canUseF7 = computed(() => isClientMounted.value && !isMultiActionSelection.value && !!activePanel.value.rootId && canCreateDir.value)
const canUseF8 = computed(() => isClientMounted.value && canUseEntryActions.value && canDelete.value)
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
const uploadProgressStatusLabel = computed(() => {
  const status = activeUploadTask.value?.status
  if (!status) {
    return t('upload.status.running')
  }

  return t(`upload.status.${status}`)
})
const uploadProgressHeader = computed(() => {
  const percent = activeUploadProgressPercent.value
  if (percent === null) {
    return uploadProgressStatusLabel.value
  }

  return `${uploadProgressStatusLabel.value} · ${percent}%`
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

function openUploadModal() {
  if (!canUseF2.value) {
    return
  }

  uploadFiles.value = []
  uploadFolderFiles.value = []
  uploadOpen.value = true
}

function setTheme(value: 'light' | 'dark') {
  currentTheme.value = value
}

const languageOptions = computed(() => ([
  { label: `${t('settings.russian')} (Russian)`, value: 'ru' as const },
  { label: `${t('settings.english')} (English)`, value: 'en' as const },
  { label: `${t('settings.chineseTraditional')} (Traditional Chinese)`, value: 'zh-Hant' as const },
  { label: `${t('settings.german')} (German)`, value: 'de' as const },
  { label: `${t('settings.spanish')} (Spanish)`, value: 'es' as const }
]))

const selectedLanguage = computed<LocaleCode>({
  get: () => {
    const value = locale.value as LocaleCode
    return SUPPORTED_LOCALES.includes(value) ? value : 'en'
  },
  set: (value) => {
    if (!value) {
      return
    }

    setLanguage(value)
  }
})

function setLanguage(value: LocaleCode) {
  if (locale.value === value) {
    return
  }

  void setLocale(value)
}

function canHandleDrop(event: DragEvent) {
  return !!event.dataTransfer
}

function onPanelDragEnter(panel: typeof leftPanel, event: DragEvent) {
  event.preventDefault()
  if (!canHandleDrop(event)) {
    return
  }

  selectPanel(panel)
  panelDragDepth[panel.id] += 1
  panelDragOver[panel.id] = true
}

function onPanelDragOver(panel: typeof leftPanel, event: DragEvent) {
  event.preventDefault()
  if (!canHandleDrop(event)) {
    return
  }

  selectPanel(panel)
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = panel.rootId ? 'copy' : 'none'
  }
  panelDragOver[panel.id] = true
}

function onPanelDragLeave(panel: typeof leftPanel, event: DragEvent) {
  if (!event.dataTransfer) {
    return
  }

  panelDragDepth[panel.id] = Math.max(0, panelDragDepth[panel.id] - 1)
  if (panelDragDepth[panel.id] === 0) {
    panelDragOver[panel.id] = false
  }
}

function readFileEntry(entry: DndFileEntry, basePath: string) {
  return new Promise<File[]>((resolve, reject) => {
    entry.file((file) => {
      const relativePath = basePath ? `${basePath}/${file.name}` : file.name
      ;(file as File & { __paneoRelativePath?: string }).__paneoRelativePath = relativePath
      resolve([file])
    }, reject)
  })
}

function readDirectoryEntries(reader: DndDirectoryReader) {
  return new Promise<DndEntry[]>((resolve, reject) => {
    reader.readEntries(resolve, reject)
  })
}

async function collectFilesFromEntry(entry: DndEntry, basePath = ''): Promise<File[]> {
  if (entry.isFile) {
    return await readFileEntry(entry as DndFileEntry, basePath)
  }

  if (!entry.isDirectory) {
    return []
  }

  const directory = entry as DndDirectoryEntry
  const reader = directory.createReader()
  const nextBasePath = basePath ? `${basePath}/${directory.name}` : directory.name
  const files: File[] = []

  while (true) {
    const entries = await readDirectoryEntries(reader)
    if (!entries.length) {
      break
    }

    for (const child of entries) {
      const childFiles = await collectFilesFromEntry(child, nextBasePath)
      files.push(...childFiles)
    }
  }

  return files
}

async function extractDroppedFiles(event: DragEvent) {
  const dataTransfer = event.dataTransfer
  if (!dataTransfer) {
    return []
  }

  const plainFiles = Array.from(dataTransfer.files || [])

  try {
    const items = Array.from(dataTransfer.items || [])
    if (!items.length) {
      return plainFiles
    }

    const entries = items
      .map((item) => {
        const webkitItem = item as DataTransferItem & { webkitGetAsEntry?: () => FileSystemEntry | null }
        return webkitItem.webkitGetAsEntry?.() || null
      })
      .filter(isDndEntry)

    const hasDirectory = entries.some(entry => entry.isDirectory)
    if (!hasDirectory && plainFiles.length) {
      return plainFiles
    }

    if (entries.length) {
      const files: File[] = []
      for (const entry of entries) {
        const collected = await collectFilesFromEntry(entry)
        files.push(...collected)
      }

      if (files.length) {
        return files
      }
    }

    if (plainFiles.length) {
      return plainFiles
    }
  } catch {
    // Fall back to plain FileList below.
  }

  return plainFiles
}

function parseDroppedUriList(raw: string) {
  return raw
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
}

function fileUriToLocalPath(uri: string) {
  try {
    const url = new URL(uri)
    if (url.protocol !== 'file:') {
      return null
    }

    if (url.hostname && url.hostname !== 'localhost') {
      return null
    }

    return decodeURIComponent(url.pathname)
  } catch {
    return null
  }
}

async function onPanelDrop(panel: typeof leftPanel, event: DragEvent) {
  event.preventDefault()
  panelDragDepth[panel.id] = 0
  panelDragOver[panel.id] = false
  selectPanel(panel)

  if (!panel.rootId) {
    toast.add({ title: t('toasts.openSourceFirst'), color: 'warning' })
    return
  }

  const uriListRaw = event.dataTransfer?.getData('text/uri-list') || ''
  const files = await extractDroppedFiles(event)
  if (!files.length) {
    const sourcePaths = parseDroppedUriList(uriListRaw)
      .map(fileUriToLocalPath)
      .filter((value): value is string => !!value)

    if (sourcePaths.length) {
      try {
        await api.importLocal(panel.rootId, panel.path, sourcePaths)
        toast.add({ title: t('toasts.uploaded'), color: 'success' })
        const selectedIndex = getSelectedIndex(panel)
        await loadPanel(panel, {
          preferredSelectedIndex: selectedIndex >= 0 ? selectedIndex : null
        })
      } catch (error) {
        toast.add({
          title: t('toasts.uploadFailed'),
          description: error instanceof Error ? error.message : String(error),
          color: 'error'
        })
      }
      return
    }

    toast.add({ title: t('toasts.dropNoFiles'), color: 'warning' })
    return
  }

  startUploadForPanel(panel, files)
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
    || uploadOpen.value
    || uploadProgressOpen.value
    || createDirOpen.value
    || renameOpen.value
    || copyConfirmOpen.value
    || copyProgressOpen.value
    || deleteConfirmOpen.value
    || settingsOpen.value
}

const uploadTotalCount = computed(() => uploadFiles.value.length + uploadFolderFiles.value.length)
const uploadSelectedCountLabel = computed(() => {
  const localeCode = locale.value === 'ru' ? 'ru' : 'en'
  const category = new Intl.PluralRules(localeCode).select(uploadTotalCount.value)
  return t(`upload.selectedCount_${category}`, { count: uploadTotalCount.value })
})

function updateUploadFiles(event: Event, setTarget: (files: File[]) => void) {
  const input = event.target as HTMLInputElement | null
  const files = input?.files ? Array.from(input.files) : []
  setTarget(files)
}

function onUploadFilesChange(event: Event) {
  updateUploadFiles(event, files => uploadFiles.value = files)
}

function onUploadFoldersChange(event: Event) {
  updateUploadFiles(event, files => uploadFolderFiles.value = files)
}

function confirmUpload() {
  if (uploadTotalCount.value === 0) {
    return
  }

  const done = uploadSelected([...uploadFiles.value, ...uploadFolderFiles.value])
  if (done) {
    uploadOpen.value = false
    uploadFiles.value = []
    uploadFolderFiles.value = []
  }
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

function focusActivePanelSelection() {
  nextTick(() => {
    const active = document.activeElement as HTMLElement | null
    active?.blur()
    focusSelectedEntry(activePanel.value)
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
  onF2: openUploadModal,
  onF3: () => canUseF3.value ? openViewer() : Promise.resolve(),
  onF4: () => canUseF4.value ? openEditor() : Promise.resolve(),
  onF5: () => canUseF5.value ? Promise.resolve(openCopy()) : Promise.resolve(),
  onF6: () => canUseF6.value ? Promise.resolve(openRename()) : Promise.resolve(),
  onF7: () => {
    if (canUseF7.value) {
      openCreateDir()
    }
  },
  onF8: () => canUseF8.value ? removeSelected() : Promise.resolve(),
  onInsert: () => toggleMarkAndMoveNext(activePanel.value),
  onT: () => toggleMarkAndMoveNext(activePanel.value)
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
  focusActivePanelSelection()
})

watch(deleteLoading, (isLoading) => {
  if (!isLoading && !deleteConfirmOpen.value) {
    focusActivePanelSelection()
  }
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
  isClientMounted.value = true
})

watch(locale, (value) => {
  localeCookie.value = value
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
          <div
            v-for="panel in [leftPanel, rightPanel]"
            :key="panel.id"
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
                panelDragOver[panel.id] ? 'ring-2 ring-primary-500' : ''
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
                  <ClientOnly>
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
                  panelDragOver[panel.id] && panel.rootId
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
                  'h-full space-y-1 overflow-auto -mr-2 pr-2',
                  activePanelId !== panel.id ? 'opacity-65' : ''
                ]"
              >
                <UButton
                  v-for="entry in panel.entries"
                  :key="entry.key"
                  class="w-full justify-start"
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
                  @click.stop="onEntryClick(panel, entry, $event)"
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
      </div>

      <UCard :ui="{ body: 'p-2' }">
        <ClientOnly>
          <div class="grid grid-cols-2 gap-2 md:grid-cols-8">
            <UButton
              :label="t('hotkeys.f1Settings')"
              icon="i-lucide-settings"
              color="neutral"
              variant="outline"
              class="justify-center"
              @click="openSettings"
            />
            <UButton
              :label="t('hotkeys.f2Upload')"
              icon="i-lucide-upload"
              color="neutral"
              variant="outline"
              class="justify-center"
              :disabled="!canUseF2"
              @click="openUploadModal"
            />
            <UButton
              :label="t('hotkeys.f3View')"
              icon="i-lucide-eye"
              color="neutral"
              variant="outline"
              class="justify-center"
              :disabled="!canUseF3"
              @click="openViewer"
            />
            <UButton
              :label="t('hotkeys.f4Edit')"
              icon="i-lucide-file-pen-line"
              color="neutral"
              variant="outline"
              class="justify-center"
              :disabled="!canUseF4"
              @click="openEditor"
            />
            <UButton
              :label="t('hotkeys.f5Copy')"
              icon="i-lucide-copy"
              color="neutral"
              variant="outline"
              class="justify-center"
              :disabled="!canUseF5"
              @click="openCopy"
            />
            <UButton
              :label="t('hotkeys.f6Rename')"
              icon="i-lucide-pencil"
              color="neutral"
              variant="outline"
              class="justify-center"
              :disabled="!canUseF6"
              @click="openRename"
            />
            <UButton
              :label="t('hotkeys.f7Create')"
              icon="i-lucide-folder-plus"
              color="neutral"
              variant="outline"
              class="justify-center"
              :disabled="!canUseF7"
              @click="openCreateDir"
            />
            <UButton
              :label="t('hotkeys.f8Delete')"
              icon="i-lucide-trash-2"
              color="error"
              variant="outline"
              class="justify-center"
              :disabled="!canUseF8"
              @click="removeSelected"
            />
          </div>
          <template #fallback>
            <div class="h-10" />
          </template>
        </ClientOnly>
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
      v-model:open="uploadOpen"
      :title="t('modal.upload')"
    >
      <template #body>
        <div class="space-y-4">
          <div class="space-y-1">
            <p class="text-sm text-muted">
              {{ t('fields.chooseFiles') }}
            </p>
            <UInput
              type="file"
              multiple
              @change="onUploadFilesChange"
            />
          </div>
          <div class="space-y-1">
            <p class="text-sm text-muted">
              {{ t('fields.chooseFolders') }}
            </p>
            <UInput
              type="file"
              multiple
              directory
              webkitdirectory
              @change="onUploadFoldersChange"
            />
          </div>
          <p class="text-xs text-muted">
            {{ uploadSelectedCountLabel }}
          </p>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end w-full gap-2">
          <UButton
            color="neutral"
            variant="outline"
            :label="t('buttons.cancel')"
            @click="uploadOpen = false"
          />
          <UButton
            :label="t('buttons.upload')"
            icon="i-lucide-upload"
            :disabled="uploadTotalCount === 0"
            @click="confirmUpload"
          />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="uploadProgressOpen"
      :title="`${t('modal.uploadProgress')} · ${uploadProgressHeader}`"
      :dismissible="false"
      :close="false"
    >
      <template #body>
        <div
          v-if="activeUploadTask"
          class="space-y-4"
        >
          <div class="space-y-1 text-sm">
            <p class="text-muted">
              {{ t('upload.to') }}
            </p>
            <p class="font-mono break-all">
              {{ activeUploadTask.toLabel }}
            </p>
          </div>

          <UProgress :model-value="activeUploadProgressPercent" />
          <div class="text-xs text-muted space-y-1">
            <p>{{ activeUploadTask.currentFile || t('upload.preparing') }}</p>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end w-full gap-2">
          <UButton
            color="warning"
            variant="outline"
            :label="t('buttons.cancelUpload')"
            icon="i-lucide-ban"
            :disabled="!activeUploadTask || activeUploadTask.status !== 'running'"
            @click="cancelActiveUploadTask"
          />
          <UButton
            color="neutral"
            variant="outline"
            :label="t('buttons.minimize')"
            icon="i-lucide-minimize-2"
            @click="minimizeActiveUploadTask"
          />
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
      :title="t('modal.create')"
    >
      <template #body>
        <div class="space-y-4">
          <UInput
            ref="createDirInputRef"
            v-model="createDirName"
            class="w-full"
            size="xl"
            :placeholder="t('fields.name')"
            @keydown.enter.prevent="createDir"
          />
          <USwitch
            v-model="createAsFile"
            :label="t('fields.file')"
          />
        </div>
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
          {{ isBulkDelete
            ? t('confirm.deleteMultiple', { count: deleteTargets.length })
            : t('confirm.delete', { name: deletePrimaryName }) }}
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
            <USelect
              v-model="selectedLanguage"
              :items="languageOptions"
              value-key="value"
              label-key="label"
              class="w-full"
            />
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
