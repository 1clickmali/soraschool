import type { NextFunction, Request, Response } from 'express'
import type { UserRole } from '@prisma/client'
import { forbidden, unauthorized } from '../lib/errors'

export function requireRoles(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized())
    if (!roles.includes(req.user.role)) {
      return next(forbidden('Votre rôle ne permet pas cette action'))
    }
    return next()
  }
}

export function requireTenantUser(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized())
  if (!req.user.institutionId) return next(forbidden('Cette action nécessite un établissement'))
  req.institutionId = req.user.institutionId
  return next()
}
