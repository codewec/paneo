import { access, stat } from 'node:fs/promises'
import { constants as fsConstants, existsSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { useRuntimeConfig } from '#imports'

export interface StartupStatus {
  fatalErrors: string[]
  warnings: string[]
  documentationUrl: string
}

interface ParsedRoot {
  name: string
  absPath: string
}

const DOCUMENTATION_URL = 'https://github.com/codewec/paneo'

function parseRoots(raw: string): ParsedRoot[] {
  const entries = String(raw || '')
    .split(/[;\n]/)
    .map(item => item.trim())
    .filter(Boolean)

  return entries.map((entry) => {
    const separatorIndex = entry.indexOf('=')
    const hasAlias = separatorIndex > 0
    const sourcePath = hasAlias ? entry.slice(separatorIndex + 1).trim() : entry
    const absPath = resolve(sourcePath)
    const name = hasAlias
      ? entry.slice(0, separatorIndex).trim() || basename(absPath)
      : basename(absPath) || absPath

    return { name, absPath }
  })
}

function isContainerRuntime() {
  const marker = process.env.CONTAINER ?? process.env.DOCKER ?? process.env.IN_DOCKER
  if (marker === '1' || marker === 'true') {
    return true
  }

  return process.platform === 'linux' && existsSync('/.dockerenv')
}

async function validateRoots(roots: ParsedRoot[]) {
  const errors: string[] = []

  for (const root of roots) {
    try {
      const rootStats = await stat(root.absPath)
      if (!rootStats.isDirectory()) {
        errors.push(`Configured source "${root.name}" is not a directory: ${root.absPath}`)
        continue
      }

      await access(root.absPath, fsConstants.R_OK | fsConstants.W_OK | fsConstants.X_OK)
    } catch (error: unknown) {
      const err = error as NodeJS.ErrnoException
      const reason = err?.code ? ` (${err.code})` : ''
      errors.push(`No read/write access to source "${root.name}": ${root.absPath}${reason}`)
    }
  }

  return errors
}

function getContainerWarnings() {
  const warnings: string[] = []
  if (!isContainerRuntime()) {
    return warnings
  }

  const uidEnv = String(process.env.UID || '').trim()
  const gidEnv = String(process.env.GID || '').trim()

  if (!uidEnv || !gidEnv) {
    warnings.push('UID/GID are not set. Container may run as root and create root-owned files.')
    return warnings
  }

  if (uidEnv === '0' || gidEnv === '0') {
    warnings.push('Container is configured with UID/GID 0 (root). Files may be created as root.')
  }

  return warnings
}

export async function getStartupStatus(): Promise<StartupStatus> {
  const config = useRuntimeConfig()
  const rawRoots = String(config.fileManagerRoots || '')
  const fatalErrors: string[] = []
  const warnings: string[] = []

  if (!rawRoots.trim()) {
    fatalErrors.push('FILE_MANAGER_ROOTS is empty.')
  } else {
    const parsedRoots = parseRoots(rawRoots)
    if (!parsedRoots.length) {
      fatalErrors.push('No valid sources were found in FILE_MANAGER_ROOTS.')
    } else {
      const rootErrors = await validateRoots(parsedRoots)
      fatalErrors.push(...rootErrors)
    }
  }

  warnings.push(...getContainerWarnings())

  return {
    fatalErrors,
    warnings,
    documentationUrl: DOCUMENTATION_URL
  }
}
