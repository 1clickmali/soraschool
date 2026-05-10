import { InstitutionStatus, SubscriptionYearStatus } from '@prisma/client'
import { prisma } from '../config/prisma'

export async function ensureAcademicYearForSubscriptionYear(params: {
  institutionId: string
  schoolYearLabel: string
  startsAt: Date
  endsAt: Date
  activate?: boolean
}) {
  const { institutionId, schoolYearLabel, startsAt, endsAt, activate = false } = params

  return prisma.$transaction(async (tx) => {
    const academicYear = await tx.academicYear.upsert({
      where: { institutionId_name: { institutionId, name: schoolYearLabel } },
      update: {
        startsAt,
        endsAt,
        ...(activate ? { isActive: true } : {})
      },
      create: {
        institutionId,
        name: schoolYearLabel,
        startsAt,
        endsAt,
        isActive: activate
      }
    })

    if (activate) {
      await tx.academicYear.updateMany({
        where: {
          institutionId,
          id: { not: academicYear.id },
          isActive: true
        },
        data: { isActive: false }
      })
      await tx.institution.update({
        where: { id: institutionId },
        data: {
          status: InstitutionStatus.ACTIVE,
          activeAcademicYearName: schoolYearLabel
        }
      })
    }

    return academicYear
  })
}

export async function syncSubscriptionYearsForInvoicePayment(params: {
  institutionId: string
  invoiceNumber: string
  paidAmount: number
  actorId?: string
}) {
  const years = await prisma.subscriptionYear.findMany({
    where: {
      institutionId: params.institutionId,
      invoiceRef: params.invoiceNumber,
      status: { not: SubscriptionYearStatus.CANCELED }
    },
    orderBy: { startsAt: 'asc' }
  })

  if (years.length === 0) return { updated: 0, activated: 0 }

  let remainingPaid = params.paidAmount
  let updated = 0
  let activated = 0
  const now = new Date()

  for (const year of years) {
    const amountPaid = Math.min(year.amountDue, Math.max(0, remainingPaid))
    remainingPaid -= amountPaid
    const fullyPaid = amountPaid >= year.amountDue
    const status = fullyPaid ? SubscriptionYearStatus.ACTIVE : SubscriptionYearStatus.PENDING_PAYMENT

    const saved = await prisma.subscriptionYear.update({
      where: { id: year.id },
      data: {
        amountPaid,
        status,
        paidAt: fullyPaid ? new Date() : null
      }
    })
    updated++

    if (fullyPaid) {
      await ensureAcademicYearForSubscriptionYear({
        institutionId: saved.institutionId,
        schoolYearLabel: saved.schoolYearLabel,
        startsAt: saved.startsAt,
        endsAt: saved.endsAt,
        activate: saved.startsAt <= now && saved.endsAt >= now
      })
      if (saved.startsAt <= now && saved.endsAt >= now) activated++
    }
  }

  if (params.actorId) {
    await prisma.auditLog.create({
      data: {
        institutionId: params.institutionId,
        actorId: params.actorId,
        action: 'SUBSCRIPTION_YEARS_SYNCED_FROM_INVOICE',
        entity: 'SaaSInvoice',
        entityId: params.invoiceNumber,
        metadata: { paidAmount: params.paidAmount, updated, activated }
      }
    })
  }

  return { updated, activated }
}
