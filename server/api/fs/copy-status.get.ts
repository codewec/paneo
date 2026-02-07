import { getQuery } from 'h3'
import { getCopyJob } from '~~/server/utils/copy-jobs'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const jobId = typeof query.jobId === 'string' ? query.jobId : ''

  if (!jobId) {
    throw createError({ statusCode: 400, statusMessage: 'jobId is required' })
  }

  return getCopyJob(jobId)
})
