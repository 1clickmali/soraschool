import type { Request } from 'express'
import { UserRole } from '@prisma/client'
import { forbidden } from './errors'

const localSchoolRoles = new Set<UserRole>([
  UserRole.DIRECTOR,
  UserRole.ADMINISTRATION,
  UserRole.SECRETARIAT,
  UserRole.ACCOUNTANT,
  UserRole.STOCK_MANAGER
])

export function isCentralAdministration(role?: UserRole) {
  return role === UserRole.CENTRAL_ADMIN || role === UserRole.SUPER_ADMIN
}

export function getScopedEstablishmentId(req: Request) {
  if (!req.user) return undefined
  if (!localSchoolRoles.has(req.user.role)) return undefined
  return req.user.establishmentId ?? undefined
}

export function resolveWritableEstablishmentId(req: Request, requestedEstablishmentId?: string | null) {
  const scopedEstablishmentId = getScopedEstablishmentId(req)
  if (!scopedEstablishmentId) return requestedEstablishmentId ?? undefined
  if (requestedEstablishmentId && requestedEstablishmentId !== scopedEstablishmentId) {
    throw forbidden("Vous ne pouvez gérer que l'établissement qui vous est affecté")
  }
  return scopedEstablishmentId
}

export function assertCanAccessEstablishment(req: Request, establishmentId?: string | null) {
  const scopedEstablishmentId = getScopedEstablishmentId(req)
  if (scopedEstablishmentId && establishmentId && establishmentId !== scopedEstablishmentId) {
    throw forbidden("Accès refusé pour cet établissement")
  }
}
