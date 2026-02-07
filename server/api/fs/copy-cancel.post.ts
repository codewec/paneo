import { readBody } from 'h3'
import { cancelCopyJob } from '~~/server/utils/copy-jobs'

interface RequestBody {
  jobId?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<RequestBody>(event)

  if (!body?.jobId) {
    throw createError({ statusCode: 400, statusMessage: 'jobId is required' })
  }

  return cancelCopyJob(body.jobId)
})
