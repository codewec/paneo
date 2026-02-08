export interface RootItem {
  id: string
  name: string
}

export interface FavoriteFolder {
  rootId: string
  path: string
}

export interface FsEntry {
  name: string
  path: string
  isDirectory: boolean
  size: number
  mtime: string
}

export type PanelEntryKind = 'root' | 'dir' | 'file' | 'up'

export interface PanelEntry {
  key: string
  name: string
  kind: PanelEntryKind
  path: string
  rootId?: string
  size: number
  mtime: string
}

export interface ListResponse {
  rootId: string
  rootName: string
  path: string
  parentPath: string | null
  entries: FsEntry[]
}

export interface PanelState {
  id: 'left' | 'right'
  rootId: string | null
  path: string
  parentPath: string | null
  entries: PanelEntry[]
  selectedKey: string | null
  markedKeys: string[]
  loading: boolean
  error: string
}

export interface LoadPanelOptions {
  preferredSelectedPath?: string | null
  preferredSelectedIndex?: number | null
}
