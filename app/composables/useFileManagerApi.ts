import type { ListResponse, RootItem } from '~/types/file-manager'

export function useFileManagerApi() {
  async function fetchRoots() {
    return await $fetch<{ roots: RootItem[] }>('/api/fs/roots')
  }

  async function fetchList(rootId: string, path: string) {
    return await $fetch<ListResponse>('/api/fs/list', {
      query: {
        rootId,
        path
      }
    })
  }

  async function readText(rootId: string, path: string) {
    return await $fetch<{ content: string }>('/api/fs/read', {
      query: {
        rootId,
        path
      }
    })
  }

  async function fetchMeta(rootId: string, path: string) {
    return await $fetch<{ path: string, mimeType: string, isText: boolean }>('/api/fs/meta', {
      query: {
        rootId,
        path
      }
    })
  }

  async function writeText(rootId: string, path: string, content: string) {
    return await $fetch('/api/fs/write', {
      method: 'POST',
      body: {
        rootId,
        path,
        content
      }
    })
  }

  async function mkdir(rootId: string, path: string, name: string) {
    return await $fetch('/api/fs/mkdir', {
      method: 'POST',
      body: {
        rootId,
        path,
        name
      }
    })
  }

  async function createFile(rootId: string, path: string, name: string) {
    return await $fetch('/api/fs/create-file', {
      method: 'POST',
      body: {
        rootId,
        path,
        name
      }
    })
  }

  async function remove(rootId: string, path: string) {
    return await $fetch('/api/fs/delete', {
      method: 'POST',
      body: {
        rootId,
        path
      }
    })
  }

  async function copy(
    fromRootId: string,
    fromPath: string,
    toRootId: string,
    toDirPath: string,
    overwriteExisting = true
  ) {
    return await $fetch<{ ok: true, result: { copiedFiles: number, copiedDirectories: number, skipped: number } }>('/api/fs/copy', {
      method: 'POST',
      body: {
        fromRootId,
        fromPath,
        toRootId,
        toDirPath,
        overwriteExisting
      }
    })
  }

  async function startCopy(
    fromRootId: string,
    fromPath: string,
    toRootId: string,
    toDirPath: string,
    overwriteExisting = true
  ) {
    return await $fetch<{ jobId: string }>('/api/fs/copy-start', {
      method: 'POST',
      body: {
        fromRootId,
        fromPath,
        toRootId,
        toDirPath,
        overwriteExisting
      }
    })
  }

  async function getCopyStatus(jobId: string) {
    return await $fetch<{
      jobId: string
      status: 'running' | 'completed' | 'failed' | 'canceled'
      result: { copiedFiles: number, copiedDirectories: number, skipped: number } | null
      error: string | null
      progress: {
        totalFiles: number
        processedFiles: number
        copiedFiles: number
        skipped: number
        currentFile: string
      }
    }>('/api/fs/copy-status', {
      query: { jobId }
    })
  }

  async function cancelCopy(jobId: string) {
    return await $fetch<{ jobId: string, status: string }>('/api/fs/copy-cancel', {
      method: 'POST',
      body: { jobId }
    })
  }

  async function move(
    fromRootId: string,
    fromPath: string,
    toRootId: string,
    toDirPath: string,
    newName?: string
  ) {
    return await $fetch('/api/fs/move', {
      method: 'POST',
      body: {
        fromRootId,
        fromPath,
        toRootId,
        toDirPath,
        newName
      }
    })
  }

  return {
    fetchRoots,
    fetchList,
    fetchMeta,
    readText,
    writeText,
    mkdir,
    createFile,
    remove,
    copy,
    startCopy,
    getCopyStatus,
    cancelCopy,
    move
  }
}
