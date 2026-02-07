import type { PanelEntry, PanelState } from '~/types/file-manager'
import type { ComputedRef } from 'vue'
import { getErrorMessage } from '~/utils/file-manager-errors'

interface PanelsContext {
  activePanel: ComputedRef<PanelState>
  passivePanel: ComputedRef<PanelState>
  leftPanel: PanelState
  rightPanel: PanelState
  selectedEntry: (panel: PanelState) => PanelEntry | null
  getSelectedIndex: (panel: PanelState) => number
  loadPanel: (panel: PanelState, options?: { preferredSelectedIndex?: number | null }) => Promise<void>
}

function isImagePath(filePath: string) {
  return /\.(jpg|jpeg|png|gif|webp|bmp|svg|ico|tiff?|avif)$/i.test(filePath)
}

function isVideoPath(filePath: string) {
  return /\.(mp4|webm|ogg|mov|m4v)$/i.test(filePath)
}

function isAudioPath(filePath: string) {
  return /\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(filePath)
}

export function useFileManagerActions(panels: PanelsContext) {
  const api = useFileManagerApi()
  const toast = useToast()
  const { t } = useI18n()

  const viewerOpen = ref(false)
  const viewerTitle = ref('')
  const viewerUrl = ref('')
  const viewerMode = ref<'image' | 'video' | 'audio' | 'document'>('document')

  const editorOpen = ref(false)
  const editorTitle = ref('')
  const editorContent = ref('')
  const editorSaving = ref(false)
  const editorTarget = ref<{ rootId: string, path: string } | null>(null)

  const createDirOpen = ref(false)
  const createDirName = ref('')
  const fileMetaCache = ref(new Map<string, { mimeType: string, isText: boolean }>())
  const selectedFileMeta = ref<{ mimeType: string, isText: boolean } | null>(null)
  const selectedFileMetaLoading = ref(false)

  const activeSelection = computed(() => panels.selectedEntry(panels.activePanel.value))
  const actionsDisabledByRootList = computed(() => !panels.activePanel.value.rootId)

  const canView = computed(() => {
    if (actionsDisabledByRootList.value) {
      return false
    }

    return activeSelection.value?.kind === 'file'
  })

  const canEdit = computed(() => canView.value && !!selectedFileMeta.value?.isText && !selectedFileMetaLoading.value)

  const canCopyOrMove = computed(() => {
    if (actionsDisabledByRootList.value) {
      return false
    }

    if (!panels.passivePanel.value.rootId) {
      return false
    }

    return activeSelection.value?.kind === 'file' || activeSelection.value?.kind === 'dir'
  })

  const canDelete = computed(() => {
    if (actionsDisabledByRootList.value) {
      return false
    }

    return activeSelection.value?.kind === 'file' || activeSelection.value?.kind === 'dir'
  })

  const canCreateDir = computed(() => !actionsDisabledByRootList.value)

  const selectedFileMetaKey = computed(() => {
    const panel = panels.activePanel.value
    const entry = panels.selectedEntry(panel)

    if (!panel.rootId || !entry || entry.kind !== 'file') {
      return null
    }

    return `${panel.rootId}:${entry.path}`
  })

  let metaRequestId = 0
  watch(selectedFileMetaKey, async (key) => {
    selectedFileMeta.value = null
    selectedFileMetaLoading.value = false

    if (!key) {
      return
    }

    const cached = fileMetaCache.value.get(key)
    if (cached) {
      selectedFileMeta.value = cached
      return
    }

    const panel = panels.activePanel.value
    const entry = panels.selectedEntry(panel)
    if (!panel.rootId || !entry || entry.kind !== 'file') {
      return
    }

    metaRequestId += 1
    const requestId = metaRequestId
    selectedFileMetaLoading.value = true

    try {
      const meta = await api.fetchMeta(panel.rootId, entry.path)
      const normalized = { mimeType: meta.mimeType, isText: meta.isText }
      fileMetaCache.value.set(key, normalized)

      if (requestId === metaRequestId) {
        selectedFileMeta.value = normalized
      }
    } catch {
      if (requestId === metaRequestId) {
        selectedFileMeta.value = null
      }
    } finally {
      if (requestId === metaRequestId) {
        selectedFileMetaLoading.value = false
      }
    }
  }, { immediate: true })

  async function reloadBothPanels() {
    const leftIndex = panels.getSelectedIndex(panels.leftPanel)
    const rightIndex = panels.getSelectedIndex(panels.rightPanel)

    await panels.loadPanel(panels.leftPanel, {
      preferredSelectedIndex: leftIndex >= 0 ? leftIndex : null
    })
    await panels.loadPanel(panels.rightPanel, {
      preferredSelectedIndex: rightIndex >= 0 ? rightIndex : null
    })
  }

  async function openViewer() {
    if (!canView.value) {
      return
    }

    const entry = panels.selectedEntry(panels.activePanel.value)
    const panel = panels.activePanel.value

    if (!entry || entry.kind !== 'file' || !panel.rootId) {
      return
    }

    viewerTitle.value = entry.name
    if (isImagePath(entry.path)) {
      viewerMode.value = 'image'
    } else if (isVideoPath(entry.path)) {
      viewerMode.value = 'video'
    } else if (isAudioPath(entry.path)) {
      viewerMode.value = 'audio'
    } else {
      viewerMode.value = 'document'
    }
    viewerUrl.value = `/api/fs/raw?rootId=${encodeURIComponent(panel.rootId)}&path=${encodeURIComponent(entry.path)}&v=${Date.now()}`
    viewerOpen.value = true
  }

  async function openEditor() {
    if (!canEdit.value) {
      return
    }

    const entry = panels.selectedEntry(panels.activePanel.value)
    const panel = panels.activePanel.value

    if (!entry || entry.kind !== 'file' || !panel.rootId) {
      return
    }

    try {
      const response = await api.readText(panel.rootId, entry.path)

      editorTarget.value = { rootId: panel.rootId, path: entry.path }
      editorTitle.value = entry.name
      editorContent.value = response.content
      editorOpen.value = true
    } catch (error) {
      toast.add({
        title: t('toasts.openFileFailed'),
        description: getErrorMessage(error),
        color: 'error'
      })
    }
  }

  async function saveEditor() {
    if (!editorTarget.value) {
      return
    }

    editorSaving.value = true

    try {
      await api.writeText(editorTarget.value.rootId, editorTarget.value.path, editorContent.value)

      toast.add({ title: t('toasts.saved'), color: 'success' })
      editorOpen.value = false
      await reloadBothPanels()
    } catch (error) {
      toast.add({
        title: t('toasts.saveFailed'),
        description: getErrorMessage(error),
        color: 'error'
      })
    } finally {
      editorSaving.value = false
    }
  }

  async function copyOrMove(mode: 'copy' | 'move') {
    if (!canCopyOrMove.value) {
      return
    }

    const sourcePanel = panels.activePanel.value
    const destinationPanel = panels.passivePanel.value
    const entry = panels.selectedEntry(sourcePanel)

    if (!entry || !sourcePanel.rootId || entry.kind === 'root' || entry.kind === 'up') {
      return
    }

    if (!destinationPanel.rootId) {
      toast.add({
        title: t('toasts.openTargetSourceFirst'),
        color: 'warning'
      })
      return
    }

    try {
      if (mode === 'copy') {
        await api.copy(sourcePanel.rootId, entry.path, destinationPanel.rootId, destinationPanel.path)
      } else {
        await api.move(sourcePanel.rootId, entry.path, destinationPanel.rootId, destinationPanel.path)
      }

      toast.add({
        title: mode === 'copy' ? t('toasts.copied') : t('toasts.moved'),
        color: 'success'
      })

      await reloadBothPanels()
    } catch (error) {
      toast.add({
        title: mode === 'copy' ? t('toasts.copyFailed') : t('toasts.moveFailed'),
        description: getErrorMessage(error),
        color: 'error'
      })
    }
  }

  async function removeSelected() {
    if (!canDelete.value) {
      return
    }

    const panel = panels.activePanel.value
    const entry = panels.selectedEntry(panel)

    if (!entry || !panel.rootId || entry.kind === 'root' || entry.kind === 'up') {
      return
    }

    const isConfirmed = window.confirm(t('confirm.delete', { name: entry.name }))
    if (!isConfirmed) {
      return
    }

    try {
      await api.remove(panel.rootId, entry.path)

      toast.add({ title: t('toasts.deleted'), color: 'success' })
      await reloadBothPanels()
    } catch (error) {
      toast.add({
        title: t('toasts.deleteFailed'),
        description: getErrorMessage(error),
        color: 'error'
      })
    }
  }

  function openCreateDir() {
    if (!canCreateDir.value) {
      toast.add({ title: t('toasts.openSourceFirst'), color: 'warning' })
      return
    }

    createDirName.value = ''
    createDirOpen.value = true
  }

  async function createDir() {
    const panel = panels.activePanel.value

    if (!panel.rootId) {
      return
    }

    try {
      await api.mkdir(panel.rootId, panel.path, createDirName.value)

      createDirOpen.value = false
      toast.add({ title: t('toasts.folderCreated'), color: 'success' })
      const currentIndex = panels.getSelectedIndex(panel)
      await panels.loadPanel(panel, {
        preferredSelectedIndex: currentIndex >= 0 ? currentIndex : null
      })
    } catch (error) {
      toast.add({
        title: t('toasts.createFolderFailed'),
        description: getErrorMessage(error),
        color: 'error'
      })
    }
  }

  return {
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
  }
}
