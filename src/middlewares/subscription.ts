import type { Request, Response, NextFunction } from 'express'
import { InstitutionStatus, SubscriptionYearStatus } from '@prisma/client'
import { prisma } from '../config/prisma'
import { ApiError } from '../lib/errors'

const BLOCKED_STATUSES: InstitutionStatus[] = [
  InstitutionStatus.SUSPENDED,
  InstitutionStatus.EXPIRED,
  InstitutionStatus.DELETED,
  InstitutionStatus.PENDING_PAYMENT,
]

// Routes allowed even when year-end blocked (read-only reports + renewal payments)
const YEAR_END_EXEMPT_PREFIXES = ['/api/reports', '/api/payments', '/api/subscription-years']

function isYearEndExempt(req: Request): boolean {
  const path = req.originalUrl.split('?')[0]
  return YEAR_END_EXEMPT_PREFIXES.some(prefix => path.startsWith(prefix))
}

export async function enforceSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const institutionId = req.user?.institutionId
    if (!institutionId) return next()

    const institution = await prisma.institution.findUnique({
      where: { id: institutionId },
      select: { status: true, trialEndsAt: true }
    })

    if (!institution) return next()

    // Auto-transition: TRIAL → PENDING_PAYMENT after trialEndsAt
    if (
      institution.status === InstitutionStatus.TRIAL &&
      institution.trialEndsAt &&
      institution.trialEndsAt < new Date()
    ) {
      await prisma.institution.update({
        where: { id: institutionId },
        data: { status: InstitutionStatus.PENDING_PAYMENT }
      })
      institution.status = InstitutionStatus.PENDING_PAYMENT
    }

    if (BLOCKED_STATUSES.includes(institution.status)) {
      if (
        (institution.status === InstitutionStatus.PENDING_PAYMENT || institution.status === InstitutionStatus.EXPIRED) &&
        isYearEndExempt(req)
      ) {
        return next()
      }
      const messages: Record<InstitutionStatus, string> = {
        [InstitutionStatus.PENDING_PAYMENT]: 'Accès suspendu — paiement en attente de validation.',
        [InstitutionStatus.SUSPENDED]: 'Cet établissement est suspendu. Contactez l\'administrateur.',
        [InstitutionStatus.EXPIRED]: 'L\'abonnement de cet établissement a expiré.',
        [InstitutionStatus.DELETED]: 'Cet établissement n\'existe plus.',
        [InstitutionStatus.TRIAL]: '',
        [InstitutionStatus.ACTIVE]: '',
      }
      return next(new ApiError(403, messages[institution.status] || 'Accès refusé', 'SUBSCRIPTION_BLOCKED'))
    }

    // Year-end blocking: check if any SubscriptionYear exists for this institution
    // and none is currently active (ACTIVE status covering today)
    if (!isYearEndExempt(req)) {
      const now = new Date()
      const activeYearSubscription = await prisma.subscriptionYear.findFirst({
        where: {
          institutionId,
          status: SubscriptionYearStatus.ACTIVE,
          startsAt: { lte: now },
          endsAt: { gte: now },
        }
      })

      if (!activeYearSubscription) {
        const hasAnyYearSubscription = await prisma.subscriptionYear.count({
          where: { institutionId }
        })

        if (hasAnyYearSubscription > 0) {
          const lastActive = await prisma.subscriptionYear.findFirst({
            where: { institutionId, status: SubscriptionYearStatus.ACTIVE },
            orderBy: { endsAt: 'desc' }
          })

          const yearLabel = lastActive?.schoolYearLabel ?? 'précédente'
          return next(new ApiError(
            403,
            `L'année scolaire ${yearLabel} est terminée. Renouvelez votre abonnement pour continuer.`,
            'ACADEMIC_YEAR_EXPIRED'
          ))
        }
      }
    }

    next()
  } catch (err) {
    next(err)
  }
}
