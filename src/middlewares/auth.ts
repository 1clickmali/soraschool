import type { NextFunction, Request, Response } from 'express'
import { UserRole } from '@prisma/client'
import { prisma } from '../config/prisma'
import { unauthorized } from '../lib/errors'
import { verifyAccessToken } from '../lib/security'

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined

  if (!token) return next(unauthorized())

  try {
    const payload = verifyAccessToken(token)
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        role: true,
        institutionId: true,
        establishmentId: true,
        isActive: true
      }
    })

    if (!user?.isActive) return next(unauthorized('Compte inactif ou introuvable'))

    req.user = {
      id: user.id,
      role: user.role,
      institutionId: user.institutionId,
      establishmentId: user.establishmentId
    }
    req.institutionId = user.institutionId ?? undefined
    return next()
  } catch {
    return next(unauthorized('Token invalide ou expiré'))
  }
}

export function optionalAuthenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined
  if (!token) return next()
  try {
    const payload = verifyAccessToken(token)
    req.user = {
      id: payload.sub,
      role: payload.role,
      institutionId: payload.institutionId,
      establishmentId: payload.establishmentId
    }
    req.institutionId = payload.institutionId ?? undefined
  } catch {
    // Optional auth must not block public school discovery.
  }
  return next()
}

export function isSuperAdmin(req: Request) {
  return req.user?.role === UserRole.SUPER_ADMIN
}
