import type { PanelEntry, PanelState } from '~/types/file-manager'
import type { ComputedRef } from 'vue'
import { h } from 'vue'
import { UProgress } from '#components'
import { getErrorMessage } from '~/utils/file-manager-errors'

interface PanelsContext {
  activePanel: ComputedRef<PanelState>
  passivePanel: ComputedRef<PanelState>
  leftPanel: PanelState
  rightPanel: PanelState
  selectedEntry: (panel: PanelState) => PanelEntry | null
  getActionEntries: (panel: PanelState) => PanelEntry[]
  getRootName: (rootId: string) => string
  getSelectedIndex: (panel: PanelState) => number
  clearMarked: (panel: PanelState) => void
  loadPanel: (panel: PanelState, options?: { preferredSelectedIndex?: number | null }) => Promise<void>
}

type CopyTaskStatus = 'running' | 'completed' | 'failed' | 'canceled'

interface CopyTask {
  id: string
  jobId: string
  fromRootId: string
  fromPath: string
  toRootId: string
  toDirPath: string
  targetBasePath: string
  deleteSource: boolean
  fromLabel: string
  toLabel: string
  status: CopyTaskStatus
  totalFiles: number
  processedFiles: number
  copiedFiles: number
  skipped: number
  currentFile: string
  error: string
  minimized: boolean
  toastId: string | number | null
  polling: boolean
}

interface CopyRequestItem {
  fromPath: string
  fromKind: 'file' | 'dir'
  fromName: string
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

function getLastPathSegment(path: string) {
  const segments = path.split('/').filter(Boolean)
  return segments.at(-1) || ''
}

function joinRelativePath(basePath: string, childName: string) {
  if (!basePath) {
    return childName
  }

  if (!childName) {
    return basePath
  }

  return `${basePath}/${childName}`
}

function isSameOrChildPath(path: string, basePath: string) {
  if (!basePath) {
    return false
  }

  return path === basePath || path.startsWith(`${basePath}/`)
}

function getParentPath(path: string) {
  const segments = path.split('/').filter(Boolean)
  if (!segments.length) {
    return ''
  }

  return segments.slice(0, -1).join('/')
}

export function useFileManagerActions(panels: PanelsContext) {
  const api = useFileManagerApi()
  const toast = useAppToast()
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
  const createAsFile = ref(false)

  const copyConfirmOpen = ref(false)
  const copyOverwriteExisting = ref(true)
  const copyDeleteSource = ref(false)
  const copySubmitting = ref(false)
  const copyFromLabel = ref('')
  const copyToLabel = ref('')
  const copyRequest = ref<{ fromRootId: string, items: CopyRequestItem[], toRootId: string, toDirPath: string } | null>(null)

  const renameOpen = ref(false)
  const renameName = ref('')
  const renameLoading = ref(false)
  const renameTarget = ref<{ rootId: string, dirPath: string, path: string, name: string } | null>(null)

  const copyTasks = ref<CopyTask[]>([])
  const copyProgressOpen = ref(false)
  const activeCopyTaskId = ref<string | null>(null)

  const deleteConfirmOpen = ref(false)
  const deleteTargets = ref<Array<{ rootId: string, path: string, name: string }>>([])
  const deleteLoading = ref(false)

  const fileMetaCache = ref(new Map<string, { mimeType: string, isText: boolean }>())
  const selectedFileMeta = ref<{ mimeType: string, isText: boolean } | null>(null)
  const selectedFileMetaLoading = ref(false)

  const activeActionEntries = computed(() => panels.getActionEntries(panels.activePanel.value))
  const activeSelection = computed(() => activeActionEntries.value[0] || null)
  const actionsDisabledByRootList = computed(() => !panels.activePanel.value.rootId)
  const isBulkDelete = computed(() => deleteTargets.value.length > 1)
  const deletePrimaryName = computed(() => deleteTargets.value[0]?.name || '')

  const canView = computed(() => {
    if (actionsDisabledByRootList.value) {
      return false
    }

    return activeSelection.value?.kind === 'file' && activeActionEntries.value.length === 1
  })

  const canEdit = computed(() => canView.value && !!selectedFileMeta.value?.isText && !selectedFileMetaLoading.value)

  const canCopyOrMove = computed(() => {
    if (actionsDisabledByRootList.value) {
      return false
    }

    if (!panels.passivePanel.value.rootId) {
      return false
    }

    return activeActionEntries.value.length > 0
  })

  const canCopy = computed(() => {
    if (!canCopyOrMove.value) {
      return false
    }

    const sourcePanel = panels.activePanel.value
    const destinationPanel = panels.passivePanel.value

    return !(sourcePanel.rootId === destinationPanel.rootId && sourcePanel.path === destinationPanel.path)
  })

  const copyDeleteSourceDisabled = computed(() => {
    const request = copyRequest.value
    if (!request) {
      return false
    }

    if (request.fromRootId !== request.toRootId) {
      return false
    }

    return request.items.some((item) => {
      if (item.fromKind !== 'dir') {
        return false
      }

      return request.toDirPath === item.fromPath || request.toDirPath.startsWith(`${item.fromPath}/`)
    })
  })

  const canUseMoveOptimization = computed(() => {
    const request = copyRequest.value
    if (!request || !copyDeleteSource.value) {
      return false
    }

    if (copyDeleteSourceDisabled.value) {
      return false
    }

    if (copyOverwriteExisting.value) {
      return false
    }

    if (request.items.length !== 1) {
      return false
    }

    return request.fromRootId === request.toRootId
  })

  const canDelete = computed(() => {
    if (actionsDisabledByRootList.value) {
      return false
    }

    return activeActionEntries.value.length > 0
  })

  const canCreateDir = computed(() => !actionsDisabledByRootList.value)
  const canRename = computed(() => {
    if (actionsDisabledByRootList.value) {
      return false
    }

    return activeActionEntries.value.length > 0
  })

  const selectedFileMetaKey = computed(() => {
    const panel = panels.activePanel.value
    const entry = panels.selectedEntry(panel)

    if (!panel.rootId || !entry || entry.kind !== 'file') {
      return null
    }

    return `${panel.rootId}:${entry.path}`
  })

  const activeCopyTask = computed(() => {
    if (!activeCopyTaskId.value) {
      return null
    }

    return copyTasks.value.find(task => task.id === activeCopyTaskId.value) || null
  })

  const activeCopyProgressPercent = computed(() => {
    const task = activeCopyTask.value
    if (!task || !task.totalFiles) {
      return null
    }

    return Math.max(0, Math.min(100, Math.round((task.processedFiles / task.totalFiles) * 100)))
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

  watch(copyConfirmOpen, (isOpen) => {
    if (!isOpen && !copySubmitting.value) {
      copyRequest.value = null
      copyFromLabel.value = ''
      copyToLabel.value = ''
      copyDeleteSource.value = false
    }
  })

  watch(copyDeleteSourceDisabled, (isDisabled) => {
    if (isDisabled && copyDeleteSource.value) {
      copyDeleteSource.value = false
    }
  })

  function wait(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  function generateTaskId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  }

  function removeTaskToast(task: CopyTask) {
    if (!task.toastId) {
      return
    }

    toast.remove(task.toastId)
    task.toastId = null
  }

  function openCopyTask(taskId: string) {
    const task = copyTasks.value.find(item => item.id === taskId)
    if (!task) {
      return
    }

    task.minimized = false
    removeTaskToast(task)

    activeCopyTaskId.value = task.id
    copyProgressOpen.value = true
  }

  function taskPercent(task: CopyTask) {
    if (!task.totalFiles) {
      return 0
    }

    return Math.max(0, Math.min(100, Math.round((task.processedFiles / task.totalFiles) * 100)))
  }

  function upsertMinimizedTaskToast(task: CopyTask) {
    const percent = taskPercent(task)
    const descriptionText = task.currentFile
      ? `${percent}% · ${task.currentFile}`
      : `${percent}%`
    const description = h('div', { class: 'space-y-2' }, [
      h('p', { class: 'text-xs text-muted' }, descriptionText),
      h(UProgress, {
        modelValue: percent,
        size: 'xs',
        color: 'info'
      })
    ])

    if (!task.toastId) {
      const added = toast.add({
        title: t('toasts.copyInProgress'),
        description,
        color: 'info',
        duration: 0,
        progress: false,
        close: false,
        onClick: () => openCopyTask(task.id),
        actions: [{
          label: t('buttons.open'),
          color: 'info',
          variant: 'ghost',
          onClick: () => openCopyTask(task.id)
        }]
      })
      task.toastId = added.id
      return
    }

    toast.update(task.toastId, {
      title: t('toasts.copyInProgress'),
      description,
      close: false,
      progress: false,
      onClick: () => openCopyTask(task.id),
      actions: [{
        label: t('buttons.open'),
        color: 'info',
        variant: 'ghost',
        onClick: () => openCopyTask(task.id)
      }]
    })
  }

  function focusAnotherRunningTaskOrClose() {
    const nextRunning = copyTasks.value.find(task => task.status === 'running' && !task.minimized)
    if (!nextRunning) {
      copyProgressOpen.value = false
      activeCopyTaskId.value = null
      return
    }

    activeCopyTaskId.value = nextRunning.id
    copyProgressOpen.value = true
  }

  async function refreshDestinationIfVisible(toRootId: string, toDirPath: string, targetBasePath: string) {
    for (const panel of [panels.leftPanel, panels.rightPanel]) {
      const isVisibleTarget = panel.rootId === toRootId
        && (
          panel.path === toDirPath
          || isSameOrChildPath(panel.path, targetBasePath)
        )

      if (isVisibleTarget) {
        const currentIndex = panels.getSelectedIndex(panel)
        await panels.loadPanel(panel, {
          preferredSelectedIndex: currentIndex >= 0 ? currentIndex : null
        })
      }
    }
  }

  async function refreshSourceAfterDeleteIfVisible(fromRootId: string, fromPath: string) {
    const parentPath = getParentPath(fromPath)
    for (const panel of [panels.leftPanel, panels.rightPanel]) {
      if (panel.rootId === fromRootId && panel.path === parentPath) {
        const currentIndex = panels.getSelectedIndex(panel)
        await panels.loadPanel(panel, {
          preferredSelectedIndex: currentIndex >= 0 ? currentIndex : null
        })
      }
    }
  }

  async function finalizeCopyTask(task: CopyTask) {
    removeTaskToast(task)

    if (task.status === 'completed') {
      if (task.deleteSource && (task.copiedFiles > 0 || task.totalFiles === 0)) {
        try {
          await api.remove(task.fromRootId, task.fromPath)
          await refreshSourceAfterDeleteIfVisible(task.fromRootId, task.fromPath)
        } catch (error) {
          toast.add({
            title: t('toasts.moveFailed'),
            description: getErrorMessage(error),
            color: 'warning'
          })
        }
      }

      const allSkipped = task.copiedFiles === 0 && task.skipped > 0
      toast.add({
        title: allSkipped
          ? t('toasts.copySkipped')
          : (task.deleteSource ? t('toasts.moved') : t('toasts.copied')),
        color: allSkipped ? 'warning' : 'success'
      })
    } else if (task.status === 'canceled') {
      toast.add({ title: t('toasts.copyCanceled'), color: 'warning' })
    } else {
      toast.add({
        title: t('toasts.copyFailed'),
        description: task.error || undefined,
        color: 'error'
      })
    }

    await refreshDestinationIfVisible(task.toRootId, task.toDirPath, task.targetBasePath)

    if (activeCopyTaskId.value === task.id) {
      focusAnotherRunningTaskOrClose()
    }
  }

  async function monitorCopyTask(taskId: string) {
    const task = copyTasks.value.find(item => item.id === taskId)
    if (!task || task.polling) {
      return
    }

    task.polling = true

    try {
      while (true) {
        await wait(300)

        const current = copyTasks.value.find(item => item.id === taskId)
        if (!current || current.status !== 'running') {
          break
        }

        const status = await api.getCopyStatus(current.jobId)
        const previousProcessedFiles = current.processedFiles
        current.totalFiles = status.progress.totalFiles
        current.processedFiles = status.progress.processedFiles
        current.copiedFiles = status.progress.copiedFiles
        current.skipped = status.progress.skipped
        current.currentFile = status.progress.currentFile

        if (current.processedFiles > previousProcessedFiles) {
          await refreshDestinationIfVisible(current.toRootId, current.toDirPath, current.targetBasePath)
        }

        if (status.status === 'running') {
          if (current.minimized) {
            upsertMinimizedTaskToast(current)
          }
          continue
        }

        if (status.status === 'completed') {
          current.status = 'completed'
          current.error = ''
        } else if (status.status === 'canceled') {
          current.status = 'canceled'
          current.error = ''
        } else {
          current.status = 'failed'
          current.error = status.error || ''
        }

        await finalizeCopyTask(current)
        break
      }
    } catch (error) {
      const current = copyTasks.value.find(item => item.id === taskId)
      if (!current) {
        return
      }

      current.status = 'failed'
      current.error = getErrorMessage(error)
      await finalizeCopyTask(current)
    } finally {
      const current = copyTasks.value.find(item => item.id === taskId)
      if (current) {
        current.polling = false
      }
    }
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

      const leftIndex = panels.getSelectedIndex(panels.leftPanel)
      const rightIndex = panels.getSelectedIndex(panels.rightPanel)
      await panels.loadPanel(panels.leftPanel, {
        preferredSelectedIndex: leftIndex >= 0 ? leftIndex : null
      })
      await panels.loadPanel(panels.rightPanel, {
        preferredSelectedIndex: rightIndex >= 0 ? rightIndex : null
      })
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

  function openCopy() {
    if (!canCopy.value) {
      return
    }

    const sourcePanel = panels.activePanel.value
    const destinationPanel = panels.passivePanel.value
    const actionEntries = panels.getActionEntries(sourcePanel)
    if (!sourcePanel.rootId || !actionEntries.length) {
      return
    }

    if (!destinationPanel.rootId) {
      toast.add({
        title: t('toasts.openTargetSourceFirst'),
        color: 'warning'
      })
      return
    }

    copyRequest.value = {
      fromRootId: sourcePanel.rootId,
      items: actionEntries.map(entry => ({
        fromPath: entry.path,
        fromKind: entry.kind as 'file' | 'dir',
        fromName: entry.name
      })),
      toRootId: destinationPanel.rootId,
      toDirPath: destinationPanel.path
    }

    const sourceRootName = panels.getRootName(sourcePanel.rootId)
    const destinationRootName = panels.getRootName(destinationPanel.rootId)
    copyFromLabel.value = actionEntries.length === 1
      ? `${sourceRootName}:/${actionEntries[0]?.path || ''}`
      : t('copy.itemsSelected', { count: actionEntries.length })
    copyToLabel.value = destinationPanel.path ? `${destinationRootName}:/${destinationPanel.path}` : `${destinationRootName}:/`
    copyOverwriteExisting.value = true
    copyDeleteSource.value = false
    copyConfirmOpen.value = true
  }

  function openRename() {
    if (!canRename.value) {
      return
    }

    const panel = panels.activePanel.value
    const entry = activeSelection.value
    if (!panel.rootId || !entry || (entry.kind !== 'file' && entry.kind !== 'dir')) {
      return
    }

    renameTarget.value = {
      rootId: panel.rootId,
      dirPath: getParentPath(entry.path),
      path: entry.path,
      name: entry.name
    }
    renameName.value = entry.name
    renameOpen.value = true
  }

  async function confirmRename() {
    if (!renameTarget.value || renameLoading.value) {
      return
    }

    const target = renameTarget.value
    const nextName = renameName.value.trim()
    if (!nextName || nextName === target.name) {
      renameOpen.value = false
      renameTarget.value = null
      return
    }

    renameLoading.value = true
    try {
      await api.move(
        target.rootId,
        target.path,
        target.rootId,
        target.dirPath,
        nextName
      )

      toast.add({ title: t('toasts.renamed'), color: 'success' })
      renameOpen.value = false
      renameTarget.value = null

      await refreshSourceAfterDeleteIfVisible(target.rootId, target.path)
    } catch (error) {
      toast.add({
        title: t('toasts.renameFailed'),
        description: getErrorMessage(error),
        color: 'error'
      })
    } finally {
      renameLoading.value = false
    }
  }

  function closeRename() {
    if (renameLoading.value) {
      return
    }

    renameOpen.value = false
    renameTarget.value = null
  }

  async function confirmCopy() {
    if (!copyRequest.value || copySubmitting.value) {
      return
    }

    copySubmitting.value = true

    try {
      if (copyDeleteSource.value && copyDeleteSourceDisabled.value) {
        copyDeleteSource.value = false
      }

      if (canUseMoveOptimization.value) {
        const request = copyRequest.value
        const item = request.items[0]
        if (!item) {
          return
        }

        await api.move(request.fromRootId, item.fromPath, request.toRootId, request.toDirPath)

        copyConfirmOpen.value = false
        copyRequest.value = null
        copyFromLabel.value = ''
        copyToLabel.value = ''
        panels.clearMarked(panels.activePanel.value)

        toast.add({ title: t('toasts.moved'), color: 'success' })
        await refreshSourceAfterDeleteIfVisible(request.fromRootId, item.fromPath)
        await refreshDestinationIfVisible(
          request.toRootId,
          request.toDirPath,
          joinRelativePath(request.toDirPath, getLastPathSegment(item.fromPath))
        )
        return
      }

      const request = copyRequest.value
      const startedTaskIds: string[] = []
      const startErrors: string[] = []

      for (const item of request.items) {
        try {
          const started = await api.startCopy(
            request.fromRootId,
            item.fromPath,
            request.toRootId,
            request.toDirPath,
            copyOverwriteExisting.value
          )

          const sourceRootName = panels.getRootName(request.fromRootId)
          const destinationRootName = panels.getRootName(request.toRootId)
          const taskId = generateTaskId()
          const task: CopyTask = {
            id: taskId,
            jobId: started.jobId,
            fromRootId: request.fromRootId,
            fromPath: item.fromPath,
            toRootId: request.toRootId,
            toDirPath: request.toDirPath,
            targetBasePath: joinRelativePath(request.toDirPath, getLastPathSegment(item.fromPath)),
            deleteSource: copyDeleteSource.value,
            fromLabel: `${sourceRootName}:/${item.fromPath}`,
            toLabel: request.toDirPath ? `${destinationRootName}:/${request.toDirPath}` : `${destinationRootName}:/`,
            status: 'running',
            totalFiles: 0,
            processedFiles: 0,
            copiedFiles: 0,
            skipped: 0,
            currentFile: '',
            error: '',
            minimized: false,
            toastId: null,
            polling: false
          }

          copyTasks.value.unshift(task)
          startedTaskIds.push(task.id)
          void monitorCopyTask(task.id)
        } catch (error) {
          startErrors.push(`${item.fromName}: ${getErrorMessage(error)}`)
        }
      }

      copyConfirmOpen.value = false
      copyRequest.value = null
      copyFromLabel.value = ''
      copyToLabel.value = ''
      if (startedTaskIds.length) {
        panels.clearMarked(panels.activePanel.value)
      }

      if (startedTaskIds.length) {
        openCopyTask(startedTaskIds[0]!)
      }

      if (startErrors.length) {
        toast.add({
          title: t('toasts.copyFailed'),
          description: startErrors[0],
          color: 'error'
        })
      }
    } catch (error) {
      toast.add({
        title: t('toasts.copyFailed'),
        description: getErrorMessage(error),
        color: 'error'
      })
    } finally {
      copySubmitting.value = false
    }
  }

  async function cancelActiveCopyTask() {
    const task = activeCopyTask.value
    if (!task || task.status !== 'running') {
      return
    }

    try {
      await api.cancelCopy(task.jobId)
    } catch {
      // final state will be resolved by polling
    }
  }

  function minimizeActiveCopyTask() {
    const task = activeCopyTask.value
    if (!task) {
      copyProgressOpen.value = false
      activeCopyTaskId.value = null
      return
    }

    task.minimized = true
    copyProgressOpen.value = false
    activeCopyTaskId.value = null

    if (task.status === 'running') {
      upsertMinimizedTaskToast(task)
    }
  }

  function closeCopyConfirm() {
    if (copySubmitting.value) {
      return
    }

    copyConfirmOpen.value = false
  }

  async function removeSelected() {
    if (!canDelete.value) {
      return
    }

    const panel = panels.activePanel.value
    if (!panel.rootId) {
      return
    }

    const entries = panels.getActionEntries(panel)
    if (!entries.length) {
      return
    }

    deleteTargets.value = entries.map(entry => ({
      rootId: panel.rootId!,
      path: entry.path,
      name: entry.name
    }))
    deleteConfirmOpen.value = true
  }

  async function confirmRemoveSelected() {
    if (!deleteTargets.value.length) {
      return
    }

    deleteLoading.value = true

    try {
      for (const target of deleteTargets.value) {
        await api.remove(target.rootId, target.path)
      }

      toast.add({ title: t('toasts.deleted'), color: 'success' })
      deleteConfirmOpen.value = false
      deleteTargets.value = []

      const leftIndex = panels.getSelectedIndex(panels.leftPanel)
      const rightIndex = panels.getSelectedIndex(panels.rightPanel)
      await panels.loadPanel(panels.leftPanel, {
        preferredSelectedIndex: leftIndex >= 0 ? leftIndex : null
      })
      await panels.loadPanel(panels.rightPanel, {
        preferredSelectedIndex: rightIndex >= 0 ? rightIndex : null
      })
    } catch (error) {
      toast.add({
        title: t('toasts.deleteFailed'),
        description: getErrorMessage(error),
        color: 'error'
      })
    } finally {
      deleteLoading.value = false
    }
  }

  function openCreateDir() {
    if (!canCreateDir.value) {
      toast.add({ title: t('toasts.openSourceFirst'), color: 'warning' })
      return
    }

    createDirName.value = ''
    createAsFile.value = false
    createDirOpen.value = true
  }

  async function createDir() {
    const panel = panels.activePanel.value

    if (!panel.rootId) {
      return
    }

    try {
      const createdName = createDirName.value.trim()
      if (createAsFile.value) {
        await api.createFile(panel.rootId, panel.path, createDirName.value)
      } else {
        await api.mkdir(panel.rootId, panel.path, createDirName.value)
      }

      createDirOpen.value = false
      toast.add({ title: createAsFile.value ? t('toasts.fileCreated') : t('toasts.folderCreated'), color: 'success' })
      const createdPath = joinRelativePath(panel.path, createdName)
      await panels.loadPanel(panel, {
        preferredSelectedPath: createdPath
      })
    } catch (error) {
      toast.add({
        title: createAsFile.value ? t('toasts.createFileFailed') : t('toasts.createFolderFailed'),
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
    createAsFile,
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
    deleteTargets,
    isBulkDelete,
    deletePrimaryName,
    deleteLoading,
    canView,
    canEdit,
    canCopyOrMove,
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
    openCopyTask,
    closeCopyConfirm,
    openRename,
    confirmRename,
    closeRename,
    removeSelected,
    confirmRemoveSelected,
    openCreateDir,
    createDir
  }
}
