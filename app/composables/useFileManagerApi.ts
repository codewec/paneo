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

  async function remove(rootId: string, path: string) {
    return await $fetch('/api/fs/delete', {
      method: 'POST',
      body: {
        rootId,
        path
      }
    })
  }

  async function copy(fromRootId: string, fromPath: string, toRootId: string, toDirPath: string) {
    return await $fetch('/api/fs/copy', {
      method: 'POST',
      body: {
        fromRootId,
        fromPath,
        toRootId,
        toDirPath
      }
    })
  }

  async function move(fromRootId: string, fromPath: string, toRootId: string, toDirPath: string) {
    return await $fetch('/api/fs/move', {
      method: 'POST',
      body: {
        fromRootId,
        fromPath,
        toRootId,
        toDirPath
      }
    })
  }

  return {
    fetchRoots,
    fetchList,
    readText,
    writeText,
    mkdir,
    remove,
    copy,
    move
  }
}
