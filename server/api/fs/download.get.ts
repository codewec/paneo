import { getQuery, sendStream, setHeader } from 'h3'
import { createDownloadArchive } from '~~/server/utils/file-manager'

function getPathsFromQuery(pathQuery: unknown) {
  if (Array.isArray(pathQuery)) {
    return pathQuery.map(item => String(item || '')).filter(Boolean)
  }

  if (typeof pathQuery === 'string' && pathQuery) {
    return [pathQuery]
  }

  return []
}

function buildContentDisposition(filename: string) {
  const encoded = encodeURIComponent(filename)
  return `attachment; filename*=UTF-8''${encoded}`
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const rootId = String(query.rootId || '')
  const paths = getPathsFromQuery(query.path)
  const archiveName = String(query.archiveName || '')

  if (!rootId || !paths.length) {
    throw createError({ statusCode: 400, statusMessage: 'rootId and path are required' })
  }

  const archive = await createDownloadArchive(rootId, paths, archiveName)
  setHeader(event, 'content-type', archive.contentType)
  setHeader(event, 'content-disposition', buildContentDisposition(archive.filename))

  return sendStream(event, archive.stream)
})
