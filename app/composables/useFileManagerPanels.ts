import type { LoadPanelOptions, PanelEntry, PanelState, RootItem } from '~/types/file-manager'
import { getErrorMessage } from '~/utils/file-manager-errors'

function createPanel(id: 'left' | 'right'): PanelState {
  return reactive({
    id,
    rootId: null,
    path: '',
    parentPath: null,
    entries: [],
    selectedKey: null,
    loading: false,
    error: ''
  })
}

function toEntryKey(kind: PanelEntry['kind'], value: string) {
  return `${kind}:${value}`
}

export function useFileManagerPanels() {
  const api = useFileManagerApi()
  const toast = useToast()
  const { t, locale } = useI18n()

  const roots = ref<RootItem[]>([])
  const rootsLoading = ref(false)
  const globalError = ref('')

  const activePanelId = ref<'left' | 'right'>('left')
  const leftPanel = createPanel('left')
  const rightPanel = createPanel('right')

  const activePanel = computed(() => activePanelId.value === 'left' ? leftPanel : rightPanel)
  const passivePanel = computed(() => activePanelId.value === 'left' ? rightPanel : leftPanel)

  const listRefs = reactive<Record<'left' | 'right', HTMLElement | null>>({
    left: null,
    right: null
  })

  const rootsMap = computed(() => {
    const map = new Map<string, string>()
    for (const root of roots.value) {
      map.set(root.id, root.name)
    }
    return map
  })

  function panelTitle(panel: PanelState) {
    if (!panel.rootId) {
      return t('panel.sources')
    }

    const rootName = rootsMap.value.get(panel.rootId) || panel.rootId
    return panel.path ? `${rootName}:/${panel.path}` : `${rootName}:/`
  }

  function formatSize(bytes: number) {
    if (!bytes) {
      return '0 B'
    }

    const units = ['B', 'KB', 'MB', 'GB']
    let value = bytes
    let unitIndex = 0

    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024
      unitIndex += 1
    }

    return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
  }

  function formatDate(value: string) {
    return new Date(value).toLocaleString(locale.value === 'ru' ? 'ru-RU' : 'en-US')
  }

  function selectedEntry(panel: PanelState) {
    if (!panel.selectedKey) {
      return null
    }

    return panel.entries.find(entry => entry.key === panel.selectedKey) || null
  }

  function isSelected(panel: PanelState, entry: PanelEntry) {
    return panel.selectedKey === entry.key
  }

  function selectedIndex(panel: PanelState) {
    if (!panel.selectedKey) {
      return -1
    }

    return panel.entries.findIndex(entry => entry.key === panel.selectedKey)
  }

  function setListRef(panelId: 'left' | 'right', element: Element | null) {
    listRefs[panelId] = element instanceof HTMLElement ? element : null
  }

  function ensureSelectionVisible(panel: PanelState) {
    nextTick(() => {
      const container = listRefs[panel.id]
      if (!container || !panel.selectedKey) {
        return
      }

      const rawKey = panel.selectedKey
      const escapedKey = typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
        ? CSS.escape(rawKey)
        : rawKey.replaceAll('"', '\\"')

      const selectedElement = container.querySelector(`[data-entry-key="${escapedKey}"]`) as HTMLElement | null
      selectedElement?.scrollIntoView({ block: 'nearest' })
    })
  }

  function selectByIndex(panel: PanelState, index: number) {
    if (!panel.entries.length) {
      panel.selectedKey = null
      return
    }

    const safeIndex = Math.max(0, Math.min(index, panel.entries.length - 1))
    panel.selectedKey = panel.entries[safeIndex]?.key || null
    ensureSelectionVisible(panel)
  }

  function moveSelection(panel: PanelState, direction: -1 | 1) {
    const currentIndex = selectedIndex(panel)

    if (currentIndex === -1) {
      selectByIndex(panel, direction > 0 ? 0 : panel.entries.length - 1)
      return
    }

    selectByIndex(panel, currentIndex + direction)
  }

  function moveSelectionByPage(panel: PanelState, direction: -1 | 1) {
    const container = listRefs[panel.id]
    if (!container) {
      moveSelection(panel, direction)
      return
    }

    const firstEntry = container.querySelector('[data-entry-key]') as HTMLElement | null
    const rowHeight = firstEntry?.offsetHeight || 36
    const pageSize = Math.max(1, Math.floor(container.clientHeight / rowHeight))
    const currentIndex = selectedIndex(panel)
    const fromIndex = currentIndex === -1 ? 0 : currentIndex

    selectByIndex(panel, fromIndex + direction * pageSize)
  }

  function selectedMtime(panel: PanelState) {
    const entry = selectedEntry(panel)
    return entry?.mtime || ''
  }

  function visibleEntryCount(panel: PanelState) {
    return panel.entries.filter(entry => entry.kind !== 'up').length
  }

  function formatItemsCount(count: number) {
    const localeCode = locale.value === 'ru' ? 'ru' : 'en'
    const category = new Intl.PluralRules(localeCode).select(count)
    const key = `panel.items_${category}`

    return t(key, { count })
  }

  function buildRootEntries() {
    return roots.value.map(root => ({
      key: toEntryKey('root', root.id),
      name: root.name,
      kind: 'root' as const,
      path: '',
      rootId: root.id,
      size: 0,
      mtime: ''
    }))
  }

  async function loadRoots() {
    rootsLoading.value = true
    globalError.value = ''

    try {
      const response = await api.fetchRoots()
      roots.value = response.roots
    } catch (error) {
      globalError.value = getErrorMessage(error)
    } finally {
      rootsLoading.value = false
    }
  }

  async function loadPanel(panel: PanelState, options?: LoadPanelOptions) {
    panel.error = ''
    panel.loading = true

    try {
      if (!panel.rootId) {
        panel.entries = buildRootEntries()
        panel.parentPath = null
        panel.selectedKey = panel.entries[0]?.key || null
        ensureSelectionVisible(panel)
        return
      }

      const response = await api.fetchList(panel.rootId, panel.path)

      panel.entries = response.entries.map(entry => ({
        key: toEntryKey(entry.isDirectory ? 'dir' : 'file', entry.path),
        name: entry.name,
        kind: entry.isDirectory ? 'dir' : 'file',
        path: entry.path,
        size: entry.size,
        mtime: entry.mtime
      }))

      panel.entries.unshift({
        key: toEntryKey('up', panel.path || 'root'),
        name: '..',
        kind: 'up',
        path: '',
        size: 0,
        mtime: ''
      })

      panel.parentPath = response.parentPath
      panel.path = response.path

      if (options?.preferredSelectedPath) {
        const preferred = panel.entries.find(entry => entry.path === options.preferredSelectedPath)
        panel.selectedKey = preferred?.key || panel.entries[0]?.key || null
      } else {
        panel.selectedKey = panel.entries[0]?.key || null
      }

      ensureSelectionVisible(panel)
    } catch (error) {
      panel.error = getErrorMessage(error)
      panel.entries = []
      panel.selectedKey = null
      throw error
    } finally {
      panel.loading = false
    }
  }

  function snapshotPanel(panel: PanelState) {
    return {
      rootId: panel.rootId,
      path: panel.path,
      parentPath: panel.parentPath,
      entries: [...panel.entries],
      selectedKey: panel.selectedKey,
      error: panel.error
    }
  }

  function restorePanel(panel: PanelState, snapshot: ReturnType<typeof snapshotPanel>) {
    panel.rootId = snapshot.rootId
    panel.path = snapshot.path
    panel.parentPath = snapshot.parentPath
    panel.entries = snapshot.entries
    panel.selectedKey = snapshot.selectedKey
    panel.error = snapshot.error
    ensureSelectionVisible(panel)
  }

  async function runSafeNavigation(
    panel: PanelState,
    mutate: () => void,
    options?: LoadPanelOptions
  ) {
    const snapshot = snapshotPanel(panel)
    mutate()

    try {
      await loadPanel(panel, options)
      return true
    } catch (error) {
      restorePanel(panel, snapshot)
      toast.add({
        title: t('alerts.noAccessFolder'),
        description: getErrorMessage(error),
        color: 'error'
      })
      return false
    }
  }

  async function initialize() {
    await loadRoots()
    await Promise.allSettled([loadPanel(leftPanel), loadPanel(rightPanel)])
  }

  function selectPanel(panel: PanelState) {
    activePanelId.value = panel.id
  }

  async function enterRoot(panel: PanelState, rootId: string) {
    await runSafeNavigation(panel, () => {
      panel.rootId = rootId
      panel.path = ''
      panel.parentPath = null
      panel.selectedKey = null
    })
  }

  async function goUp(panel: PanelState) {
    selectPanel(panel)

    if (!panel.rootId) {
      return
    }

    const previousPath = panel.path

    if (!panel.path) {
      panel.rootId = null
      panel.path = ''
      panel.parentPath = null
      await loadPanel(panel)
      return
    }

    await runSafeNavigation(panel, () => {
      panel.path = panel.parentPath || ''
    }, { preferredSelectedPath: previousPath })
  }

  async function onEntryClick(panel: PanelState, entry: PanelEntry) {
    selectPanel(panel)

    const alreadySelected = panel.selectedKey === entry.key
    panel.selectedKey = entry.key
    ensureSelectionVisible(panel)

    if (!alreadySelected) {
      return
    }

    if (entry.kind === 'root' && entry.rootId) {
      await enterRoot(panel, entry.rootId)
      return
    }

    if (entry.kind === 'up') {
      await goUp(panel)
      return
    }

    if (entry.kind === 'dir') {
      await runSafeNavigation(panel, () => {
        panel.path = entry.path
      })
    }
  }

  async function openSelectedEntry(panel: PanelState) {
    const entry = selectedEntry(panel)
    if (!entry) {
      return
    }

    if (entry.kind === 'root' && entry.rootId) {
      await enterRoot(panel, entry.rootId)
      return
    }

    if (entry.kind === 'up') {
      await goUp(panel)
      return
    }

    if (entry.kind === 'dir') {
      await runSafeNavigation(panel, () => {
        panel.path = entry.path
      })
    }
  }

  function switchActivePanel() {
    activePanelId.value = activePanelId.value === 'left' ? 'right' : 'left'
  }

  return {
    roots,
    rootsLoading,
    globalError,
    activePanelId,
    leftPanel,
    rightPanel,
    activePanel,
    passivePanel,
    panelTitle,
    formatSize,
    formatDate,
    selectedEntry,
    isSelected,
    selectedMtime,
    visibleEntryCount,
    formatItemsCount,
    setListRef,
    moveSelection,
    moveSelectionByPage,
    loadPanel,
    initialize,
    selectPanel,
    enterRoot,
    goUp,
    onEntryClick,
    openSelectedEntry,
    switchActivePanel
  }
}
