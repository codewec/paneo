import type { ListResponse, RootItem } from '~/types/file-manager'

export function useFileManagerApi() {
  const runtimeConfig = useRuntimeConfig()
  const rawChunkSizeMb = Number(runtimeConfig.public.uploadChunkSizeMb)
  const uploadChunkSizeMb = Number.isFinite(rawChunkSizeMb) && rawChunkSizeMb > 0 ? rawChunkSizeMb : 1
  const UPLOAD_CHUNK_SIZE = Math.max(256 * 1024, Math.floor(uploadChunkSizeMb * 1024 * 1024))

  const rawChunkDelayMs = Number(runtimeConfig.public.uploadChunkDelayMs)
  const UPLOAD_CHUNK_DELAY_MS = Number.isFinite(rawChunkDelayMs) && rawChunkDelayMs >= 0
    ? Math.floor(rawChunkDelayMs)
    : 10

  interface UploadProgress {
    totalFiles: number
    processedFiles: number
    currentFile: string
    totalBytes: number
    uploadedBytes: number
  }

  interface UploadOptions {
    signal?: AbortSignal
    onProgress?: (progress: UploadProgress) => void
  }

  function sleep(ms: number) {
    if (ms <= 0) {
      return Promise.resolve()
    }

    return new Promise<void>((resolve) => {
      setTimeout(resolve, ms)
    })
  }

  function createAbortError() {
    const abortError = new Error('Upload canceled')
    ;(abortError as { name: string }).name = 'AbortError'
    return abortError
  }

  function isAbortLikeError(error: unknown, signal?: AbortSignal) {
    if (signal?.aborted) {
      return true
    }

    const err = error as { name?: string, message?: string }
    const message = (err?.message || '').toLowerCase()
    return err?.name === 'AbortError' || message.includes('aborted') || message.includes('operation aborted')
  }

  async function cancelUploadTemp(rootId: string, uploadIds: string[]) {
    if (!uploadIds.length) {
      return
    }

    await $fetch('/api/fs/upload-cancel', {
      method: 'POST',
      body: {
        rootId,
        uploadIds
      }
    })
  }

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

  async function upload(rootId: string, path: string, files: File[], options?: UploadOptions) {
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0)
    let uploadedBytes = 0
    const startedUploadIds: string[] = []

    try {
      for (const [fileIndex, file] of files.entries()) {
        const rawRelativePath = (file as File & { webkitRelativePath?: string, __paneoRelativePath?: string }).webkitRelativePath
        const fallbackRelativePath = (file as File & { __paneoRelativePath?: string }).__paneoRelativePath
        const relativePath = rawRelativePath || fallbackRelativePath || file.name
        const uploadId = globalThis.crypto?.randomUUID?.().replaceAll('-', '')
          || (String(Date.now()) + Math.random().toString(36).slice(2, 10))
        startedUploadIds.push(uploadId)
        const totalChunks = Math.max(1, Math.ceil(file.size / UPLOAD_CHUNK_SIZE))

        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
          if (options?.signal?.aborted) {
            throw createAbortError()
          }

          const start = chunkIndex * UPLOAD_CHUNK_SIZE
          const end = Math.min(file.size, start + UPLOAD_CHUNK_SIZE)
          const chunk = file.slice(start, end)

          try {
            await $fetch<{ ok: true, completed: boolean }>('/api/fs/upload', {
              method: 'POST',
              query: {
                rootId,
                path
              },
              headers: {
                'x-upload-id': uploadId,
                'x-file-path': encodeURIComponent(relativePath),
                'x-chunk-index': String(chunkIndex),
                'x-total-chunks': String(totalChunks)
              },
              body: chunk,
              signal: options?.signal
            })
          } catch (error) {
            if (isAbortLikeError(error, options?.signal)) {
              throw createAbortError()
            }

            throw error
          }

          uploadedBytes += chunk.size
          options?.onProgress?.({
            totalFiles: files.length,
            processedFiles: chunkIndex === totalChunks - 1
              ? fileIndex + 1
              : fileIndex,
            currentFile: relativePath,
            totalBytes,
            uploadedBytes
          })
          if (UPLOAD_CHUNK_DELAY_MS > 0 && chunkIndex < totalChunks - 1) {
            await sleep(UPLOAD_CHUNK_DELAY_MS)
          }
        }
      }

      return {
        ok: true as const,
        uploaded: files.length
      }
    } catch (error) {
      if (isAbortLikeError(error, options?.signal)) {
        await cancelUploadTemp(rootId, startedUploadIds).catch(() => undefined)
        throw createAbortError()
      }

      throw error
    }
  }

  async function importLocal(rootId: string, path: string, sourcePaths: string[]) {
    return await $fetch<{ ok: true, imported: number }>('/api/fs/import-local', {
      method: 'POST',
      body: {
        rootId,
        path,
        sourcePaths
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
    upload,
    importLocal,
    remove,
    copy,
    startCopy,
    getCopyStatus,
    cancelCopy,
    move
  }
}
