import crypto from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../config/prisma'
import { ApiError } from '../lib/errors'
import { logger } from '../lib/logger'
import { verifyAccessToken } from '../lib/security'

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000

function isExemptPath(path: string) {
  return (
    path.startsWith('/api/auth/request-otp') ||
    path.startsWith('/api/auth/verify-otp') ||
    path.startsWith('/api/auth/refresh') ||
    path.startsWith('/api/auth/logout') ||
    path.startsWith('/api/platform') ||
    path.startsWith('/docs') ||
    path === '/health' ||
    path === '/api' ||
    path === '/'
  )
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonicalize(item)])
    )
  }
  return value
}

function requestHash(req: Request) {
  const payload = {
    method: req.method,
    path: req.originalUrl.split('?')[0],
    query: canonicalize(req.query),
    body: canonicalize(req.body ?? {})
  }
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}

function resolveActor(req: Request) {
  if (req.user) return req.user
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined
  if (!token) return undefined
  try {
    const payload = verifyAccessToken(token)
    return {
      id: payload.sub,
      role: payload.role,
      institutionId: payload.institutionId,
      establishmentId: payload.establishmentId
    }
  } catch {
    return undefined
  }
}

function publicResponseBody(body: unknown): Prisma.InputJsonValue {
  if (body === undefined) return {}
  if (Buffer.isBuffer(body)) return { type: 'buffer', base64: body.toString('base64') }
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as Prisma.InputJsonValue
    } catch {
      return { text: body }
    }
  }
  return body as Prisma.InputJsonValue
}

export async function idempotency(req: Request, res: Response, next: NextFunction) {
  if (!MUTATING_METHODS.has(req.method) || isExemptPath(req.path)) return next()

  const key = String(req.get('Idempotency-Key') || req.get('X-Idempotency-Key') || '').trim()
  if (!key) {
    return next(new ApiError(428, 'Clé d’idempotence requise pour cette action sensible.', 'IDEMPOTENCY_KEY_REQUIRED'))
  }

  if (key.length < 12 || key.length > 180) {
    return next(new ApiError(400, 'Clé d’idempotence invalide.', 'IDEMPOTENCY_KEY_INVALID'))
  }

  const actor = resolveActor(req)
  const userId = actor?.id
  const institutionId = actor?.institutionId ?? req.institutionId ?? undefined
  const actorKey = userId ?? institutionId ?? req.ip ?? 'anonymous'
  const action = `${req.method} ${req.originalUrl.split('?')[0]}`
  const hash = requestHash(req)
  const expiresAt = new Date(Date.now() + DEFAULT_TTL_MS)

  const resolveExisting = async () => {
    const existing = await prisma.idempotencyKey.findFirst({
      where: { key, actorKey, action },
      orderBy: { createdAt: 'desc' }
    })

    if (!existing) {
      return next(new ApiError(409, 'Action déjà en cours. Réessayez dans quelques secondes.', 'IDEMPOTENCY_CONFLICT'))
    }

    if (existing.requestHash !== hash) {
      await prisma.auditLog.create({
        data: {
          institutionId,
          actorId: userId,
          action: 'IDEMPOTENCY_HASH_MISMATCH',
          entity: 'IdempotencyKey',
          entityId: existing.id,
          ip: req.ip,
          userAgent: req.get('user-agent'),
          metadata: { key, action }
        }
      }).catch(() => undefined)
      return next(new ApiError(409, 'Cette clé d’idempotence existe déjà pour une requête différente.', 'IDEMPOTENCY_HASH_MISMATCH'))
    }

    if (existing.state === 'COMPLETED' && existing.responseStatus && existing.responseBody !== null) {
      await prisma.auditLog.create({
        data: {
          institutionId,
          actorId: userId,
          action: 'IDEMPOTENCY_REPLAYED',
          entity: 'IdempotencyKey',
          entityId: existing.id,
          ip: req.ip,
          userAgent: req.get('user-agent'),
          metadata: { key, action }
        }
      }).catch(() => undefined)
      res.setHeader('Idempotency-Replayed', 'true')
      return res.status(existing.responseStatus).json(existing.responseBody)
    }

    return next(new ApiError(409, 'Cette action est déjà en cours. Aucun doublon n’a été créé.', 'IDEMPOTENCY_IN_PROGRESS'))
  }

  try {
    const existing = await prisma.idempotencyKey.findFirst({
      where: { key, actorKey, action },
      orderBy: { createdAt: 'desc' }
    })
    if (existing) return resolveExisting()

    await prisma.idempotencyKey.create({
      data: {
        key,
        actorKey,
        userId,
        institutionId,
        action,
        requestHash: hash,
        expiresAt
      }
    })
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') return next(err)
    return resolveExisting()
  }

  const originalJson = res.json.bind(res)
  const originalSend = res.send.bind(res)
  let captured = false

  const complete = (body: unknown) => {
    if (captured || res.statusCode >= 500) return
    captured = true
    const payload = publicResponseBody(body)
    prisma.idempotencyKey.updateMany({
      where: { key, actorKey, action, requestHash: hash },
      data: {
        responseStatus: res.statusCode,
        responseBody: payload,
        state: 'COMPLETED',
        completedAt: new Date()
      }
    }).catch((err) => logger.error({ err, key, action }, 'Unable to persist idempotency response'))
  }

  res.json = ((body: unknown) => {
    complete(body)
    return originalJson(body)
  }) as Response['json']

  res.send = ((body?: unknown) => {
    complete(body)
    return originalSend(body as never)
  }) as Response['send']

  return next()
}
