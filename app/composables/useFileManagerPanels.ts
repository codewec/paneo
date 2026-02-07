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
    markedKeys: [],
    loading: false,
    error: ''
  })
}

function toEntryKey(kind: PanelEntry['kind'], value: string) {
  return `${kind}:${value}`
}

interface PanelLocation {
  rootId: string | null
  path: string
}

interface NavigationOptions {
  recordHistory?: boolean
}

interface StoredPanelsState {
  activePanelId?: 'left' | 'right'
  left?: PanelLocation
  right?: PanelLocation
}

const PANELS_COOKIE_KEY = 'ffile.panels'

function getParentPath(path: string) {
  const segments = path.split('/').filter(Boolean)
  if (!segments.length) {
    return ''
  }

  return segments.slice(0, -1).join('/')
}

export function useFileManagerPanels() {
  const api = useFileManagerApi()
  const toast = useAppToast()
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
  const backHistory = reactive<Record<'left' | 'right', PanelLocation[]>>({
    left: [],
    right: []
  })

  const rootsMap = computed(() => {
    const map = new Map<string, string>()
    for (const root of roots.value) {
      map.set(root.id, root.name)
    }
    return map
  })

  const panelsCookie = useCookie<StoredPanelsState | null>(PANELS_COOKIE_KEY, {
    secure: false,
    sameSite: 'lax',
    path: '/'
  })

  function readStoredPanelsState(): StoredPanelsState | null {
    try {
      const raw = panelsCookie.value
      if (!raw) {
        return null
      }

      if (typeof raw === 'string') {
        const parsed = JSON.parse(raw) as StoredPanelsState
        return parsed && typeof parsed === 'object' ? parsed : null
      }

      if (typeof raw !== 'object') {
        return null
      }

      return raw
    } catch {
      return null
    }
  }

  function normalizeStoredLocation(raw: PanelLocation | undefined, knownRootIds: Set<string>): PanelLocation {
    if (!raw?.rootId || !knownRootIds.has(raw.rootId)) {
      return { rootId: null, path: '' }
    }

    return {
      rootId: raw.rootId,
      path: typeof raw.path === 'string' ? raw.path.trim().replace(/^\/+/, '') : ''
    }
  }

  function savePanelsState() {
    const state: StoredPanelsState = {
      activePanelId: activePanelId.value,
      left: getPanelLocation(leftPanel),
      right: getPanelLocation(rightPanel)
    }

    try {
      panelsCookie.value = state
    } catch {
      // Ignore cookie serialization errors.
    }
  }

  function getPanelLocation(panel: PanelState): PanelLocation {
    return {
      rootId: panel.rootId,
      path: panel.path
    }
  }

  function isSameLocation(a: PanelLocation, b: PanelLocation) {
    return a.rootId === b.rootId && a.path === b.path
  }

  function pushBackHistory(panel: PanelState, location: PanelLocation) {
    const stack = backHistory[panel.id]
    stack.push({ ...location })
    if (stack.length > 32) {
      stack.splice(0, stack.length - 32)
    }
  }

  function panelTitle(panel: PanelState) {
    if (!panel.rootId) {
      return t('panel.sources')
    }

    const rootName = rootsMap.value.get(panel.rootId) || panel.rootId
    return panel.path ? `${rootName}:/${panel.path}` : `${rootName}:/`
  }

  function getRootName(rootId: string) {
    return rootsMap.value.get(rootId) || rootId
  }

  function pathParts(panel: PanelState) {
    if (!panel.rootId) {
      return []
    }

    const rootName = rootsMap.value.get(panel.rootId) || panel.rootId
    const parts: Array<{ label: string, path: string }> = [{ label: rootName, path: '' }]

    if (!panel.path) {
      return parts
    }

    const segments = panel.path.split('/').filter(Boolean)
    let currentPath = ''

    for (const segment of segments) {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment
      parts.push({ label: segment, path: currentPath })
    }

    return parts
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

  function isMarkable(entry: PanelEntry) {
    return entry.kind === 'file' || entry.kind === 'dir'
  }

  function isMarked(panel: PanelState, entry: PanelEntry) {
    return panel.markedKeys.includes(entry.key)
  }

  function clearMarked(panel: PanelState) {
    panel.markedKeys = []
  }

  function getActionEntries(panel: PanelState) {
    if (panel.markedKeys.length) {
      const markedEntries = panel.entries.filter(entry => panel.markedKeys.includes(entry.key) && isMarkable(entry))
      if (markedEntries.length) {
        return markedEntries
      }
    }

    const current = selectedEntry(panel)
    if (!current || !isMarkable(current)) {
      return []
    }

    return [current]
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

  function focusSelectedEntry(panel: PanelState) {
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
      selectedElement?.focus()
    })
  }

  function selectByIndex(panel: PanelState, index: number) {
    if (!panel.entries.length) {
      panel.selectedKey = null
      clearMarked(panel)
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
        clearMarked(panel)
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
      clearMarked(panel)

      if (options?.preferredSelectedPath) {
        const preferred = panel.entries.find(entry => entry.path === options.preferredSelectedPath)
        panel.selectedKey = preferred?.key || panel.entries[0]?.key || null
      } else if (typeof options?.preferredSelectedIndex === 'number') {
        const safeIndex = Math.max(0, Math.min(options.preferredSelectedIndex, panel.entries.length - 1))
        panel.selectedKey = panel.entries[safeIndex]?.key || null
      } else {
        panel.selectedKey = panel.entries[0]?.key || null
      }

      ensureSelectionVisible(panel)
    } catch (error) {
      panel.error = getErrorMessage(error)
      panel.entries = []
      panel.selectedKey = null
      clearMarked(panel)
      throw error
    } finally {
      panel.loading = false
    }
  }

  async function loadPanelWithFallback(panel: PanelState) {
    while (panel.rootId) {
      try {
        await loadPanel(panel)
        return
      } catch {
        if (panel.path) {
          panel.path = getParentPath(panel.path)
          continue
        }

        panel.rootId = null
        panel.path = ''
        panel.parentPath = null
        break
      }
    }

    await loadPanel(panel)
  }

  function snapshotPanel(panel: PanelState) {
    return {
      rootId: panel.rootId,
      path: panel.path,
      parentPath: panel.parentPath,
      entries: [...panel.entries],
      selectedKey: panel.selectedKey,
      markedKeys: [...panel.markedKeys],
      error: panel.error
    }
  }

  function restorePanel(panel: PanelState, snapshot: ReturnType<typeof snapshotPanel>) {
    panel.rootId = snapshot.rootId
    panel.path = snapshot.path
    panel.parentPath = snapshot.parentPath
    panel.entries = snapshot.entries
    panel.selectedKey = snapshot.selectedKey
    panel.markedKeys = snapshot.markedKeys
    panel.error = snapshot.error
    ensureSelectionVisible(panel)
  }

  async function runSafeNavigation(
    panel: PanelState,
    mutate: () => void,
    options?: LoadPanelOptions,
    navigationOptions?: NavigationOptions
  ) {
    const snapshot = snapshotPanel(panel)
    const fromLocation = getPanelLocation(panel)
    mutate()
    const toLocation = getPanelLocation(panel)

    try {
      await loadPanel(panel, options)
      if (navigationOptions?.recordHistory !== false && !isSameLocation(fromLocation, toLocation)) {
        pushBackHistory(panel, fromLocation)
      }
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

    const knownRootIds = new Set(roots.value.map(root => root.id))
    const stored = readStoredPanelsState()

    if (stored) {
      const leftLocation = normalizeStoredLocation(stored.left, knownRootIds)
      leftPanel.rootId = leftLocation.rootId
      leftPanel.path = leftLocation.path
      leftPanel.parentPath = null

      const rightLocation = normalizeStoredLocation(stored.right, knownRootIds)
      rightPanel.rootId = rightLocation.rootId
      rightPanel.path = rightLocation.path
      rightPanel.parentPath = null

      if (stored.activePanelId === 'left' || stored.activePanelId === 'right') {
        activePanelId.value = stored.activePanelId
      }
    }

    await Promise.allSettled([
      loadPanelWithFallback(leftPanel),
      loadPanelWithFallback(rightPanel)
    ])

    // On app load, selection should consistently start from the first row.
    leftPanel.selectedKey = leftPanel.entries[0]?.key || null
    rightPanel.selectedKey = rightPanel.entries[0]?.key || null
    clearMarked(leftPanel)
    clearMarked(rightPanel)
    ensureSelectionVisible(leftPanel)
    ensureSelectionVisible(rightPanel)

    savePanelsState()
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

  async function navigateToPath(panel: PanelState, path: string) {
    if (!panel.rootId) {
      return
    }

    if (panel.path === path) {
      return
    }

    await runSafeNavigation(panel, () => {
      panel.path = path
    })
  }

  async function openSources(panel: PanelState) {
    selectPanel(panel)

    if (!panel.rootId) {
      return
    }

    await runSafeNavigation(panel, () => {
      panel.rootId = null
      panel.path = ''
      panel.parentPath = null
    })
  }

  async function goUp(panel: PanelState) {
    selectPanel(panel)

    if (!panel.rootId) {
      return
    }

    const previousPath = panel.path

    if (!panel.path) {
      await runSafeNavigation(panel, () => {
        panel.rootId = null
        panel.path = ''
        panel.parentPath = null
      })
      return
    }

    await runSafeNavigation(panel, () => {
      panel.path = panel.parentPath || ''
    }, { preferredSelectedPath: previousPath })
  }

  function canGoBack(panel: PanelState) {
    return backHistory[panel.id].length > 0
  }

  async function goBack(panel: PanelState) {
    selectPanel(panel)
    const stack = backHistory[panel.id]
    const target = stack.pop()
    if (!target) {
      return
    }

    const success = await runSafeNavigation(
      panel,
      () => {
        panel.rootId = target.rootId
        panel.path = target.path
        panel.parentPath = null
      },
      undefined,
      { recordHistory: false }
    )

    if (!success) {
      stack.push(target)
    }
  }

  async function mirrorFromOpposite(panel: PanelState) {
    const opposite = panel.id === 'left' ? rightPanel : leftPanel
    const oppositeLocation = getPanelLocation(opposite)
    const currentLocation = getPanelLocation(panel)

    if (isSameLocation(currentLocation, oppositeLocation)) {
      return
    }

    await runSafeNavigation(panel, () => {
      panel.rootId = oppositeLocation.rootId
      panel.path = oppositeLocation.path
      panel.parentPath = null
    })
  }

  async function onEntryClick(panel: PanelState, entry: PanelEntry, event?: MouseEvent) {
    selectPanel(panel)

    const currentIndex = selectedIndex(panel)
    const targetIndex = panel.entries.findIndex(item => item.key === entry.key)
    if (targetIndex < 0) {
      return
    }

    if (event?.shiftKey && currentIndex >= 0) {
      const from = Math.min(currentIndex, targetIndex)
      const to = Math.max(currentIndex, targetIndex)
      const range = panel.entries.slice(from, to + 1).filter(isMarkable).map(item => item.key)
      panel.markedKeys = range
      panel.selectedKey = entry.key
      ensureSelectionVisible(panel)
      return
    }

    if (event?.ctrlKey) {
      panel.selectedKey = entry.key
      if (isMarkable(entry)) {
        if (panel.markedKeys.includes(entry.key)) {
          panel.markedKeys = panel.markedKeys.filter(key => key !== entry.key)
        } else {
          panel.markedKeys = [...panel.markedKeys, entry.key]
        }
      }
      ensureSelectionVisible(panel)
      return
    }

    panel.selectedKey = entry.key
    clearMarked(panel)
    ensureSelectionVisible(panel)
  }

  async function openEntry(panel: PanelState, entry: PanelEntry) {
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

  async function onEntryDoubleClick(panel: PanelState, entry: PanelEntry) {
    await onEntryClick(panel, entry)
    await openEntry(panel, entry)
  }

  async function openSelectedEntry(panel: PanelState) {
    const entry = selectedEntry(panel)
    if (!entry) {
      return
    }

    await openEntry(panel, entry)
  }

  function switchActivePanel() {
    activePanelId.value = activePanelId.value === 'left' ? 'right' : 'left'
  }

  function getSelectedIndex(panel: PanelState) {
    return selectedIndex(panel)
  }

  function toggleMarkAndMoveNext(panel: PanelState) {
    const current = selectedEntry(panel)
    if (!current) {
      return
    }

    if (isMarkable(current)) {
      if (panel.markedKeys.includes(current.key)) {
        panel.markedKeys = panel.markedKeys.filter(key => key !== current.key)
      } else {
        panel.markedKeys = [...panel.markedKeys, current.key]
      }
    }

    moveSelection(panel, 1)
  }

  watch(
    () => [
      activePanelId.value,
      leftPanel.rootId, leftPanel.path,
      rightPanel.rootId, rightPanel.path
    ],
    () => {
      savePanelsState()
    }
  )

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
    getRootName,
    formatSize,
    formatDate,
    selectedEntry,
    isSelected,
    isMarked,
    getActionEntries,
    selectedMtime,
    visibleEntryCount,
    formatItemsCount,
    pathParts,
    canGoBack,
    getSelectedIndex,
    setListRef,
    focusSelectedEntry,
    clearMarked,
    moveSelection,
    moveSelectionByPage,
    toggleMarkAndMoveNext,
    loadPanel,
    initialize,
    selectPanel,
    enterRoot,
    openSources,
    navigateToPath,
    goUp,
    goBack,
    mirrorFromOpposite,
    onEntryClick,
    onEntryDoubleClick,
    openSelectedEntry,
    switchActivePanel
  }
}
