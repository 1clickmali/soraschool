import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import multer from 'multer'
import { env } from '../config/env'
import { badRequest } from './errors'

const acceptedMimeTypes = new Set(['application/pdf', 'image/jpeg', 'image/png'])
const uploadRoot = path.resolve(env.UPLOAD_ROOT)

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true })
}

export function buildStorageKey(parts: string[]) {
  return parts.map((part) => sanitizeStorageSegment(part)).join('/')
}

export function resolveStoragePath(fileKey: string) {
  if (!fileKey) throw badRequest('Chemin de fichier invalide')
  const filePath = path.resolve(uploadRoot, fileKey)
  assertInsideUploadRoot(filePath)
  return filePath
}

export function storageKeyFromPath(filePath: string) {
  const resolvedPath = path.resolve(filePath)
  assertInsideUploadRoot(resolvedPath)
  return path.relative(uploadRoot, resolvedPath)
}

export function sanitizeStorageSegment(value: unknown, fallback = 'misc') {
  const segment = String(value ?? fallback)
    .trim()
    .replace(/[\\/]+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 96)
  return segment && segment !== '.' && segment !== '..' ? segment : fallback
}

export function safeDownloadName(value: string | null | undefined, fallback = 'document') {
  const name = String(value ?? fallback)
    .replace(/[\r\n"\\/]+/g, '_')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, 140)
  return name || fallback
}

function assertInsideUploadRoot(filePath: string) {
  const relative = path.relative(uploadRoot, filePath)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw badRequest('Chemin de fichier non autorisé')
  }
}

const storage = multer.diskStorage({
  destination(req, _file, cb) {
    try {
      const institutionId = sanitizeStorageSegment(req.institutionId ?? req.user?.institutionId ?? 'platform', 'platform')
      const ownerType = sanitizeStorageSegment(req.body.ownerType ?? req.params.ownerType ?? 'misc')
      const ownerId = sanitizeStorageSegment(req.body.ownerId ?? req.params.ownerId ?? 'shared', 'shared')
      const destination = path.resolve(uploadRoot, institutionId, ownerType, ownerId)
      assertInsideUploadRoot(destination)
      ensureDir(destination)
      cb(null, destination)
    } catch (error) {
      cb(error as Error, '')
    }
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, `${Date.now()}-${randomUUID()}${ext}`)
  }
})

export const upload = multer({
  storage,
  limits: {
    fileSize: env.MAX_UPLOAD_MB * 1024 * 1024,
    files: 10
  },
  fileFilter(_req, file, cb) {
    if (!acceptedMimeTypes.has(file.mimetype)) {
      return cb(badRequest('Format non autorisé. Formats acceptés : PDF, JPG, PNG'))
    }
    return cb(null, true)
  }
})
