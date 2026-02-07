import { readBody } from 'h3'
import { writeTextFile } from '~~/server/utils/file-manager'

interface RequestBody {
  rootId?: string
  path?: string
  content?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<RequestBody>(event)

  if (!body?.rootId || !body.path || typeof body.content !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'rootId, path and content are required' })
  }

  await writeTextFile(body.rootId, body.path, body.content)

  return { ok: true }
})
