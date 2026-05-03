import type { NextFunction, Request, Response } from 'express'
import { InstitutionStatus, UserRole } from '@prisma/client'
import { prisma } from '../config/prisma'
import { forbidden, notFound } from '../lib/errors'

export async function resolveInstitutionBySlug(req: Request, _res: Response, next: NextFunction) {
  const slug = req.params.slug
  const institution = await prisma.institution.findUnique({
    where: { slug },
    select: { id: true, status: true }
  })

  if (!institution) return next(notFound('Établissement introuvable'))
  if (
    institution.status === InstitutionStatus.SUSPENDED ||
    institution.status === InstitutionStatus.EXPIRED ||
    institution.status === InstitutionStatus.DELETED
  ) {
    return next(forbidden('Cet établissement est suspendu ou expiré'))
  }

  req.institutionId = institution.id
  return next()
}

export function enforceTenantIsolation(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.role === UserRole.SUPER_ADMIN) return next()
  if (!req.user?.institutionId || !req.institutionId) return next(forbidden('Établissement requis'))
  if (req.user.institutionId !== req.institutionId) {
    return next(forbidden('Accès interdit à un autre établissement'))
  }
  return next()
}
