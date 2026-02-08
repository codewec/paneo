<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import type { PanelEntry } from '~/types/file-manager'
import { SUPPORTED_LOCALES } from '~/types/locale'
import type { LocaleCode } from '~/types/locale'

// This component orchestrates the full file manager workspace UI.
// Page-level routing/auth is kept outside to make future auth flows simpler.
const LOCALE_COOKIE_KEY = 'paneo.locale'

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
const toast = useAppToast()
const panelDragOver = reactive<Record<'left' | 'right', boolean>>({
  left: false,
  right: false
})
const panelDragDepth = reactive<Record<'left' | 'right', number>>({
  left: 0,
  right: 0
})
const pathScrollRefs = reactive<Record<'left' | 'right', HTMLElement | null>>({
  left: null,
  right: null
})
const pathCanScrollLeft = reactive<Record<'left' | 'right', boolean>>({
  left: false,
  right: false
})
const pathCanScrollRight = reactive<Record<'left' | 'right', boolean>>({
  left: false,
  right: false
})

const INTERNAL_PANEL_DND_TYPE = 'application/x-paneo-panel-dnd'

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

function setPathScrollRef(panelId: 'left' | 'right', el: Element | ComponentPublicInstance | null) {
  const element = el && '$el' in el
    ? ((el.$el as HTMLElement | undefined) ?? null)
    : (el as HTMLElement | null)

  pathScrollRefs[panelId] = element
  updatePathScrollState(panelId)
}

function updatePathScrollState(panelId: 'left' | 'right') {
  const element = pathScrollRefs[panelId]
  if (!element) {
    pathCanScrollLeft[panelId] = false
    pathCanScrollRight[panelId] = false
    return
  }

  const maxScrollLeft = Math.max(0, element.scrollWidth - element.clientWidth)
  pathCanScrollLeft[panelId] = element.scrollLeft > 0
  pathCanScrollRight[panelId] = element.scrollLeft < maxScrollLeft - 1
}

function scrollPathToEnd(panelId: 'left' | 'right') {
  const element = pathScrollRefs[panelId]
  if (!element) {
    return
  }

  element.scrollLeft = element.scrollWidth
  updatePathScrollState(panelId)
}

function scrollPathBy(panelId: 'left' | 'right', direction: 'left' | 'right') {
  const element = pathScrollRefs[panelId]
  if (!element) {
    return
  }

  const step = Math.max(120, Math.round(element.clientWidth * 0.45))
  element.scrollBy({
    left: direction === 'left' ? -step : step,
    behavior: 'smooth'
  })
}

function onPathWheel(panelId: 'left' | 'right', event: WheelEvent) {
  const element = pathScrollRefs[panelId]
  if (!element) {
    return
  }

  const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
  if (!delta) {
    return
  }

  element.scrollLeft += delta
  updatePathScrollState(panelId)
}

const {
  globalError,
  startupFatalErrors,
  startupWarnings,
  documentationUrl,
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

const hasStartupFatalErrors = computed(() => startupFatalErrors.value.length > 0)

const {
  viewerOpen,
  viewerTitle,
  viewerUrl,
  viewerMode,
  viewerTextContent,
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
  downloadConfirmOpen,
  downloadTargets,
  downloadArchiveName,
  isBulkDownload,
  downloadPrimaryName,
  canEdit,
  canCopy,
  canRename,
  canDelete,
  canDownload,
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
  openDownload,
  confirmDownload,
  removeSelected,
  confirmRemoveSelected,
  openCreateDir,
  createDir,
  uploadSelected,
  startUploadForPanel
} = useFileManagerActions(panels)

const {
  favoritesOpen,
  favoritesLoading,
  favoritesWithLabel,
  isFavorite,
  openFavorites,
  refreshFavorites,
  removeFavoriteItem,
  toggleFavorite,
  openFavoriteInActivePanel
} = useFileManagerFavorites(panels)

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
const deleteTargetPaths = computed(() => deleteTargets.value.map((target) => {
  const rootName = panels.getRootName(target.rootId)
  return rootName + ':/' + target.path
}))
const downloadTargetPaths = computed(() => downloadTargets.value.map((target) => {
  const rootName = panels.getRootName(target.rootId)
  return rootName + ':/' + target.path
}))

const canUseF2 = computed(() => isClientMounted.value)
const canUseF3 = computed(() => isClientMounted.value && !isMultiActionSelection.value && canUseFileActions.value)
const canUseF9 = computed(() => isClientMounted.value && !!activePanel.value.rootId && canUpload.value)
const canUseF10 = computed(() => isClientMounted.value && canDownload.value)
const canUseF4 = computed(() => isClientMounted.value && !isMultiActionSelection.value && canUseFileActions.value && canEdit.value)
const canUseF5 = computed(() => isClientMounted.value && canUseEntryActions.value && canCopy.value)
const canUseF6 = computed(() => isClientMounted.value && !isMultiActionSelection.value && canUseEntryActions.value && canRename.value)
const canUseF7 = computed(() => isClientMounted.value && !isMultiActionSelection.value && !!activePanel.value.rootId && canCreateDir.value)
const canUseF8 = computed(() => isClientMounted.value && canUseEntryActions.value && canDelete.value)
const favoritesSelectedIndex = ref(0)
const selectedFavoriteItem = computed(() => favoritesWithLabel.value[favoritesSelectedIndex.value] || null)
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
  if (!canUseF9.value) {
    return
  }

  uploadFiles.value = []
  uploadFolderFiles.value = []
  uploadOpen.value = true
}

function openFavoritesModal() {
  if (!canUseF2.value) {
    return
  }

  void openFavorites()
}

function isEntryFavorite(panel: typeof leftPanel, entry: PanelEntry) {
  if (!panel.rootId || entry.kind !== 'dir') {
    return false
  }

  return isFavorite(panel.rootId, entry.path)
}

function onFavoriteToggle(panel: typeof leftPanel, entry: PanelEntry) {
  if (entry.kind !== 'dir') {
    return
  }

  void toggleFavorite(panel, entry)
}

function isTypingElement(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  const tag = target.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') {
    return true
  }

  return target.isContentEditable
}

function toggleActivePanelFavoriteByKeyboard() {
  const panel = activePanel.value
  const entry = activePanelSelectedEntry.value

  if (!panel.rootId || !entry || entry.kind !== 'dir') {
    return
  }

  onFavoriteToggle(panel, entry)
}

function handleFavoritesModalKeydown(event: KeyboardEvent) {
  if (!favoritesOpen.value || isTypingElement(event.target)) {
    return
  }

  const total = favoritesWithLabel.value.length
  if (!total) {
    return
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    favoritesSelectedIndex.value = (favoritesSelectedIndex.value + 1) % total
    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    favoritesSelectedIndex.value = (favoritesSelectedIndex.value - 1 + total) % total
    return
  }

  if (event.key === 'Enter') {
    event.preventDefault()
    event.stopPropagation()

    const favorite = selectedFavoriteItem.value
    if (favorite) {
      void openFavoriteInActivePanel(favorite)
    }
  }
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

function getOppositePanel(panel: typeof leftPanel) {
  return panel.id === 'left' ? rightPanel : leftPanel
}

function getPanelById(panelId: 'left' | 'right') {
  return panelId === 'left' ? leftPanel : rightPanel
}

function hasDataTransferType(dataTransfer: DataTransfer, type: string) {
  const types = dataTransfer.types as unknown as { contains?: (value: string) => boolean }
  if (typeof types?.contains === 'function') {
    return types.contains(type)
  }

  return Array.from(dataTransfer.types || []).includes(type)
}

function getInternalDragSourceId(event: DragEvent): 'left' | 'right' | null {
  const dataTransfer = event.dataTransfer
  if (!dataTransfer || !hasDataTransferType(dataTransfer, INTERNAL_PANEL_DND_TYPE)) {
    return null
  }

  const raw = dataTransfer.getData(INTERNAL_PANEL_DND_TYPE)
  return raw === 'left' || raw === 'right' ? raw : null
}

function canCopyBetweenPanels(sourcePanel: typeof leftPanel, targetPanel: typeof leftPanel) {
  if (!sourcePanel.rootId || !targetPanel.rootId) {
    return false
  }

  if (sourcePanel.rootId === targetPanel.rootId && sourcePanel.path === targetPanel.path) {
    return false
  }

  return panels.getActionEntries(sourcePanel).length > 0
}

function canStartPanelEntryDrag(panel: typeof leftPanel, entry: { key: string, kind: string }) {
  if (entry.kind !== 'file' && entry.kind !== 'dir') {
    return false
  }

  const actionEntries = panels.getActionEntries(panel)
  if (!actionEntries.length) {
    return false
  }

  if (!actionEntries.some(item => item.key === entry.key)) {
    return false
  }

  return canCopyBetweenPanels(panel, getOppositePanel(panel))
}

function onEntryDragStart(panel: typeof leftPanel, entry: { key: string, kind: string }, event: DragEvent) {
  if (!canStartPanelEntryDrag(panel, entry)) {
    event.preventDefault()
    return
  }

  const dataTransfer = event.dataTransfer
  if (!dataTransfer) {
    event.preventDefault()
    return
  }
  selectPanel(panel)
  dataTransfer.effectAllowed = 'copy'
  dataTransfer.setData(INTERNAL_PANEL_DND_TYPE, panel.id)
}

function onEntryDragEnd() {
  panelDragDepth.left = 0
  panelDragDepth.right = 0
  panelDragOver.left = false
  panelDragOver.right = false
}

function canHandleDrop(event: DragEvent) {
  return !!event.dataTransfer
}

function onPanelDragEnter(panel: typeof leftPanel, event: DragEvent) {
  event.preventDefault()
  if (!canHandleDrop(event)) {
    return
  }

  panelDragDepth[panel.id] += 1
  panelDragOver[panel.id] = true
}

function onPanelDragOver(panel: typeof leftPanel, event: DragEvent) {
  event.preventDefault()
  if (!canHandleDrop(event)) {
    return
  }

  const sourceId = getInternalDragSourceId(event)
  if (event.dataTransfer) {
    if (sourceId) {
      const sourcePanel = getPanelById(sourceId)
      event.dataTransfer.dropEffect = canCopyBetweenPanels(sourcePanel, panel) ? 'copy' : 'none'
    } else {
      event.dataTransfer.dropEffect = panel.rootId ? 'copy' : 'none'
    }
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

  const internalSourceId = getInternalDragSourceId(event)
  if (internalSourceId) {
    const sourcePanel = getPanelById(internalSourceId)
    if (canCopyBetweenPanels(sourcePanel, panel)) {
      selectPanel(sourcePanel)
      openCopy()
    }
    return
  }

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
    || downloadConfirmOpen.value
    || favoritesOpen.value
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

function handleDownloadConfirmEnter(event: KeyboardEvent) {
  if (!downloadConfirmOpen.value) {
    return
  }

  if (event.key !== 'Enter') {
    return
  }

  event.preventDefault()
  event.stopPropagation()
  confirmDownload()
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
  onF2: openFavoritesModal,
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
  onF9: openUploadModal,
  onF10: () => {
    if (canUseF10.value) {
      openDownload()
    }
  },
  onF: toggleActivePanelFavoriteByKeyboard,
  onInsert: () => toggleMarkAndMoveNext(activePanel.value),
  onT: () => toggleMarkAndMoveNext(activePanel.value)
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

watch(downloadConfirmOpen, (isOpen) => {
  if (isOpen) {
    window.addEventListener('keydown', handleDownloadConfirmEnter, true)
    return
  }

  window.removeEventListener('keydown', handleDownloadConfirmEnter, true)
})

watch(copyConfirmOpen, (isOpen) => {
  if (isOpen) {
    window.addEventListener('keydown', handleCopyConfirmEnter, true)
    return
  }

  window.removeEventListener('keydown', handleCopyConfirmEnter, true)
})

watch(favoritesWithLabel, (items) => {
  if (!items.length) {
    favoritesSelectedIndex.value = 0
    return
  }

  if (favoritesSelectedIndex.value >= items.length) {
    favoritesSelectedIndex.value = items.length - 1
  }
})

watch(favoritesOpen, (isOpen) => {
  if (isOpen) {
    favoritesSelectedIndex.value = 0
    window.addEventListener('keydown', handleFavoritesModalKeydown, true)
    return
  }

  window.removeEventListener('keydown', handleFavoritesModalKeydown, true)
})

watch(() => [leftPanel.rootId, leftPanel.path], () => {
  nextTick(() => {
    scrollPathToEnd('left')
  })
})

watch(() => [rightPanel.rootId, rightPanel.path], () => {
  nextTick(() => {
    scrollPathToEnd('right')
  })
})

function handleWindowResize() {
  updatePathScrollState('left')
  updatePathScrollState('right')
}

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleDeleteConfirmEnter, true)
  window.removeEventListener('keydown', handleDownloadConfirmEnter, true)
  window.removeEventListener('keydown', handleCopyConfirmEnter, true)
  window.removeEventListener('keydown', handleFavoritesModalKeydown, true)
  window.removeEventListener('resize', handleWindowResize)
})

onMounted(() => {
  isClientMounted.value = true
  window.addEventListener('resize', handleWindowResize)

  nextTick(() => {
    scrollPathToEnd('left')
    scrollPathToEnd('right')
  })
})

watch(locale, (value) => {
  localeCookie.value = value
})

await initialize()
if (!hasStartupFatalErrors.value) {
  await refreshFavorites()
}
</script>

<template>
  <div class="h-[100dvh] w-full overflow-hidden bg-default p-2">
    <div class="flex h-full flex-col gap-2">
      <!-- Startup validation messages are rendered in a dedicated component. -->
      <FileManagerStartupAlerts
        :global-error="globalError"
        :fatal-errors="startupFatalErrors"
        :warnings="startupWarnings"
        :documentation-url="documentationUrl"
      />

      <div
        v-if="!hasStartupFatalErrors"
        class="min-h-0 flex-1"
      >
        <div class="grid h-full gap-2 lg:grid-cols-2">
          <FileManagerPanelCard
            v-for="panel in [leftPanel, rightPanel]"
            :key="panel.id"
            :panel="panel"
            :active-panel-id="activePanelId"
            :panel-drag-over="panelDragOver[panel.id]"
            :path-can-scroll-left="pathCanScrollLeft[panel.id]"
            :path-can-scroll-right="pathCanScrollRight[panel.id]"
            :path-parts="pathParts(panel)"
            :panel-title="panelTitle(panel)"
            :can-go-back="canGoBack(panel)"
            :visible-entry-count="visibleEntryCount(panel)"
            :selected-mtime="selectedMtime(panel)"
            :set-path-scroll-ref="setPathScrollRef"
            :update-path-scroll-state="updatePathScrollState"
            :on-path-wheel="onPathWheel"
            :scroll-path-by="scrollPathBy"
            :on-select-panel="selectPanel"
            :on-open-sources="openSources"
            :on-navigate-to-path="navigateToPath"
            :on-refresh-both-panels="refreshBothPanels"
            :on-mirror-from-opposite="mirrorFromOpposite"
            :on-go-back="goBack"
            :set-panel-list-ref="setPanelListRef"
            :is-selected="isSelected"
            :is-marked="isMarked"
            :can-start-panel-entry-drag="canStartPanelEntryDrag"
            :on-entry-click="onEntryClick"
            :on-entry-double-click="onEntryDoubleClick"
            :on-entry-drag-start="onEntryDragStart"
            :on-entry-drag-end="onEntryDragEnd"
            :format-size="formatSize"
            :format-date="formatDate"
            :format-items-count="formatItemsCount"
            :is-entry-favorite="isEntryFavorite"
            :on-favorite-toggle="onFavoriteToggle"
            :on-panel-drag-enter="onPanelDragEnter"
            :on-panel-drag-over="onPanelDragOver"
            :on-panel-drag-leave="onPanelDragLeave"
            :on-panel-drop="onPanelDrop"
          />
        </div>
      </div>

      <FileManagerActionBar
        v-if="!hasStartupFatalErrors"
        :disabled="{
          f2: !canUseF2,
          f3: !canUseF3,
          f4: !canUseF4,
          f5: !canUseF5,
          f6: !canUseF6,
          f7: !canUseF7,
          f8: !canUseF8,
          f9: !canUseF9,
          f10: !canUseF10
        }"
        @settings="openSettings"
        @favorites="openFavoritesModal"
        @view="openViewer"
        @edit="openEditor"
        @copy="openCopy"
        @rename="openRename"
        @create="openCreateDir"
        @remove="removeSelected"
        @upload="openUploadModal"
        @download="openDownload"
      />
    </div>

    <FileManagerViewerModal
      v-model:open="viewerOpen"
      :title="viewerTitle"
      :url="viewerUrl"
      :mode="viewerMode"
      :text-content="viewerTextContent"
    />

    <FileManagerEditorModal
      v-model:open="editorOpen"
      v-model:content="editorContent"
      :editor-title="editorTitle"
      :saving="editorSaving"
      @save="saveEditor"
    />

    <FileManagerUploadModal
      v-model:open="uploadOpen"
      :upload-total-count="uploadTotalCount"
      :upload-selected-count-label="uploadSelectedCountLabel"
      @upload-files-change="onUploadFilesChange"
      @upload-folders-change="onUploadFoldersChange"
      @confirm="confirmUpload"
    />

    <FileManagerUploadProgressModal
      v-model:open="uploadProgressOpen"
      :title="`${t('modal.uploadProgress')} · ${uploadProgressHeader}`"
      :active-task="activeUploadTask"
      :progress-percent="activeUploadProgressPercent"
      @cancel="cancelActiveUploadTask"
      @minimize="minimizeActiveUploadTask"
    />

    <FileManagerCopyConfirmModal
      v-model:open="copyConfirmOpen"
      v-model:overwrite-existing="copyOverwriteExisting"
      v-model:delete-source="copyDeleteSource"
      :submitting="copySubmitting"
      :from-label="copyFromLabel"
      :to-label="copyToLabel"
      :delete-source-disabled="copyDeleteSourceDisabled"
      @confirm="confirmCopy"
      @cancel="closeCopyConfirm"
    />

    <FileManagerRenameModal
      v-model:open="renameOpen"
      v-model:name="renameName"
      :loading="renameLoading"
      @confirm="confirmRename"
      @cancel="closeRename"
    />

    <FileManagerCopyProgressModal
      v-model:open="copyProgressOpen"
      :title="`${t('modal.copyProgress')} · ${copyProgressHeader}`"
      :active-task="activeCopyTask"
      :progress-percent="activeCopyProgressPercent"
      @cancel="cancelActiveCopyTask"
      @minimize="minimizeActiveCopyTask"
    />

    <FileManagerCreateEntryModal
      v-model:open="createDirOpen"
      v-model:name="createDirName"
      v-model:as-file="createAsFile"
      @confirm="createDir"
    />

    <FileManagerDownloadConfirmModal
      v-model:open="downloadConfirmOpen"
      v-model:archive-name="downloadArchiveName"
      :is-bulk-download="isBulkDownload"
      :download-targets-length="downloadTargets.length"
      :download-primary-name="downloadPrimaryName"
      :download-target-paths="downloadTargetPaths"
      @confirm="confirmDownload"
    />
    <FileManagerFavoritesModal
      v-model:open="favoritesOpen"
      v-model:selected-index="favoritesSelectedIndex"
      :loading="favoritesLoading"
      :items="favoritesWithLabel"
      @open-item="openFavoriteInActivePanel"
      @remove-item="removeFavoriteItem"
    />

    <FileManagerDeleteConfirmModal
      v-model:open="deleteConfirmOpen"
      :is-bulk-delete="isBulkDelete"
      :delete-targets-length="deleteTargets.length"
      :delete-primary-name="deletePrimaryName"
      :delete-target-paths="deleteTargetPaths"
      :loading="deleteLoading"
      @confirm="confirmRemoveSelected"
    />

    <FileManagerSettingsModal
      v-model:open="settingsOpen"
      v-model:selected-language="selectedLanguage"
      :language-options="languageOptions"
      :current-theme="currentTheme"
      @set-theme="setTheme"
    />
  </div>
</template>
