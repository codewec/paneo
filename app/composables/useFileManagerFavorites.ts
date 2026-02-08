import type { FavoriteFolder, PanelEntry, PanelState } from '~/types/file-manager'
import type { ComputedRef } from 'vue'
import { getErrorMessage } from '~/utils/file-manager-errors'

interface FavoritesPanelsContext {
  activePanel: ComputedRef<PanelState>
  selectPanel: (panel: PanelState) => void
  enterRoot: (panel: PanelState, rootId: string) => Promise<void>
  navigateToPath: (panel: PanelState, path: string) => Promise<void>
  getRootName: (rootId: string) => string
}

function toFavoriteKey(rootId: string, path: string) {
  return `${rootId}:${path}`
}

export function useFileManagerFavorites(panels: FavoritesPanelsContext) {
  const api = useFileManagerApi()
  const toast = useAppToast()
  const { t } = useI18n()

  const favoritesOpen = ref(false)
  const favoritesLoading = ref(false)
  const favorites = ref<FavoriteFolder[]>([])

  const favoriteSet = computed(() => {
    const set = new Set<string>()
    for (const item of favorites.value) {
      set.add(toFavoriteKey(item.rootId, item.path))
    }
    return set
  })

  const favoritesWithLabel = computed(() => {
    return favorites.value.map((item) => {
      const rootName = panels.getRootName(item.rootId)
      const fullPath = item.path ? `${rootName}:/${item.path}` : `${rootName}:/`
      const name = item.path.split('/').filter(Boolean).at(-1) || rootName

      return {
        ...item,
        name,
        fullPath
      }
    })
  })

  function isFavorite(rootId: string | null | undefined, path: string | null | undefined) {
    if (!rootId) {
      return false
    }

    const normalizedPath = String(path || '').trim()
    return favoriteSet.value.has(toFavoriteKey(rootId, normalizedPath))
  }

  async function refreshFavorites() {
    favoritesLoading.value = true
    try {
      const response = await api.fetchFavorites()
      favorites.value = response.items
    } catch (error) {
      toast.add({
        title: t('toasts.favoritesLoadFailed'),
        description: getErrorMessage(error),
        color: 'error'
      })
    } finally {
      favoritesLoading.value = false
    }
  }

  async function openFavorites() {
    favoritesOpen.value = true
    await refreshFavorites()
  }

  async function removeFavoriteItem(item: FavoriteFolder) {
    try {
      const response = await api.removeFavorite(item.rootId, item.path)
      favorites.value = response.items
    } catch (error) {
      toast.add({
        title: t('toasts.favoritesUpdateFailed'),
        description: getErrorMessage(error),
        color: 'error'
      })
    }
  }

  async function toggleFavorite(panel: PanelState, entry: PanelEntry) {
    if (!panel.rootId || entry.kind !== 'dir') {
      return
    }

    try {
      if (isFavorite(panel.rootId, entry.path)) {
        const response = await api.removeFavorite(panel.rootId, entry.path)
        favorites.value = response.items
        toast.add({ title: t('toasts.favoriteRemoved'), color: 'neutral' })
      } else {
        const response = await api.addFavorite(panel.rootId, entry.path)
        favorites.value = response.items
        toast.add({ title: t('toasts.favoriteAdded'), color: 'success' })
      }
    } catch (error) {
      toast.add({
        title: t('toasts.favoritesUpdateFailed'),
        description: getErrorMessage(error),
        color: 'error'
      })
    }
  }

  async function openFavoriteInActivePanel(item: FavoriteFolder) {
    const panel = panels.activePanel.value
    panels.selectPanel(panel)

    try {
      if (panel.rootId !== item.rootId) {
        await panels.enterRoot(panel, item.rootId)
      }

      if (panel.path !== item.path) {
        await panels.navigateToPath(panel, item.path)
      }

      favoritesOpen.value = false
    } catch (error) {
      toast.add({
        title: t('toasts.favoriteOpenFailed'),
        description: getErrorMessage(error),
        color: 'error'
      })
    }
  }

  return {
    favoritesOpen,
    favoritesLoading,
    favorites,
    favoritesWithLabel,
    isFavorite,
    openFavorites,
    refreshFavorites,
    removeFavoriteItem,
    toggleFavorite,
    openFavoriteInActivePanel
  }
}
