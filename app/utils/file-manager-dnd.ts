const INTERNAL_PANEL_DND_TYPE = 'application/x-paneo-panel-dnd'

type DndEntry = FileSystemEntry
type DndFileEntry = FileSystemFileEntry
type DndDirectoryReader = FileSystemDirectoryReader
type DndDirectoryEntry = FileSystemDirectoryEntry

function isDndEntry(entry: FileSystemEntry | null): entry is DndEntry {
  return entry !== null
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

function hasDataTransferType(dataTransfer: DataTransfer, type: string) {
  const types = dataTransfer.types as unknown as { contains?: (value: string) => boolean }
  if (typeof types?.contains === 'function') {
    return types.contains(type)
  }

  return Array.from(dataTransfer.types || []).includes(type)
}

export function getInternalDragSourceId(event: DragEvent): 'left' | 'right' | null {
  const dataTransfer = event.dataTransfer
  if (!dataTransfer || !hasDataTransferType(dataTransfer, INTERNAL_PANEL_DND_TYPE)) {
    return null
  }

  const raw = dataTransfer.getData(INTERNAL_PANEL_DND_TYPE)
  return raw === 'left' || raw === 'right' ? raw : null
}

export function setInternalDragSource(dataTransfer: DataTransfer, panelId: 'left' | 'right') {
  dataTransfer.setData(INTERNAL_PANEL_DND_TYPE, panelId)
}

export function canHandleDrop(event: DragEvent) {
  return !!event.dataTransfer
}

export async function extractDroppedFiles(event: DragEvent) {
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

export function parseDroppedUriList(raw: string) {
  return raw
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
}

export function fileUriToLocalPath(uri: string) {
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
