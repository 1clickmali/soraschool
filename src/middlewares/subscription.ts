import type { Request, Response, NextFunction } from 'express'
import { InstitutionStatus, SubscriptionStatus } from '@prisma/client'
import { prisma } from '../config/prisma'
import { ApiError } from '../lib/errors'

const BLOCKED_STATUSES: InstitutionStatus[] = [
  InstitutionStatus.SUSPENDED,
  InstitutionStatus.EXPIRED,
  InstitutionStatus.DELETED,
  InstitutionStatus.PENDING_PAYMENT,
]

export async function enforceSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const institutionId = req.user?.institutionId
    if (!institutionId) return next()

    // Check trial expiry and update status automatically
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

    next()
  } catch (err) {
    next(err)
  }
}
