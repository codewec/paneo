import { randomUUID } from 'node:crypto'
import { createError } from 'h3'
import { copyPath } from '~~/server/utils/file-manager'
import type { CopyProgress } from '~~/server/utils/file-manager'

type CopyJobStatus = 'running' | 'completed' | 'failed' | 'canceled'

interface CopyJobResult {
  copiedFiles: number
  copiedDirectories: number
  skipped: number
}

interface CopyJob {
  id: string
  status: CopyJobStatus
  controller: AbortController
  result: CopyJobResult | null
  error: string | null
  progress: CopyProgress
}

interface StartCopyJobInput {
  fromRootId: string
  fromPath: string
  toRootId: string
  toDirPath: string
  newName?: string
  overwriteExisting?: boolean
}

const copyJobs = new Map<string, CopyJob>()

export function startCopyJob(input: StartCopyJobInput) {
  const id = randomUUID()
  const controller = new AbortController()

  const job: CopyJob = {
    id,
    status: 'running',
    controller,
    result: null,
    error: null,
    progress: {
      totalFiles: 0,
      processedFiles: 0,
      copiedFiles: 0,
      skipped: 0,
      totalBytes: 0,
      processedBytes: 0,
      currentFile: '',
      currentFileBytes: 0,
      currentFileTotalBytes: 0
    }
  }

  copyJobs.set(id, job)

  void (async () => {
    try {
      const result = await copyPath(
        input.fromRootId,
        input.fromPath,
        input.toRootId,
        input.toDirPath,
        input.newName,
        input.overwriteExisting ?? true,
        controller.signal,
        (progress) => {
          job.progress = progress
        }
      )
      if (job.status !== 'running' || controller.signal.aborted) {
        job.status = 'canceled'
        job.error = null
        return
      }

      job.status = 'completed'
      job.result = result
    } catch (error: unknown) {
      if (controller.signal.aborted || (error as NodeJS.ErrnoException).code === 'ABORT_ERR') {
        job.status = 'canceled'
        job.error = null
        return
      }

      job.status = 'failed'
      job.error = error instanceof Error ? error.message : 'Copy failed'
    }
  })()

  return { jobId: id }
}

export function getCopyJob(jobId: string) {
  const job = copyJobs.get(jobId)
  if (!job) {
    throw createError({ statusCode: 404, statusMessage: 'Copy job not found' })
  }

  return {
    jobId: job.id,
    status: job.status,
    result: job.result,
    error: job.error,
    progress: job.progress
  }
}

export function cancelCopyJob(jobId: string) {
  const job = copyJobs.get(jobId)
  if (!job) {
    throw createError({ statusCode: 404, statusMessage: 'Copy job not found' })
  }

  if (job.status === 'running') {
    job.status = 'canceled'
    job.error = null
    job.controller.abort()
  }

  return {
    jobId: job.id,
    status: job.status
  }
}
