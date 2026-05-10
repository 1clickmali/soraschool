import { Router } from 'express'
import { z } from 'zod'
import { SubscriptionYearStatus, UserRole } from '@prisma/client'
import { prisma } from '../../config/prisma'
import { asyncHandler } from '../../lib/async'
import { notFound, forbidden } from '../../lib/errors'
import { authenticate } from '../../middlewares/auth'
import { requireRoles, requireTenantUser } from '../../middlewares/rbac'
import { validate } from '../../middlewares/validate'
import { createSaaSInvoice } from '../../lib/saas-billing'
import { ensureAcademicYearForSubscriptionYear, syncSubscriptionYearsForInvoicePayment } from '../../lib/subscription-year-access'

export const subscriptionYearsRoutes = Router()
subscriptionYearsRoutes.use(authenticate)

function decorateSubscriptionYear<T extends {
  schoolYearLabel: string
  amountDue: number
  amountPaid: number
  status: SubscriptionYearStatus
  startsAt: Date
  endsAt: Date
}>(year: T) {
  const now = new Date()
  return {
    ...year,
    yearLabel: year.schoolYearLabel,
    remainingAmount: Math.max(0, year.amountDue - year.amountPaid),
    accessActive:
      year.status === SubscriptionYearStatus.ACTIVE &&
      year.startsAt <= now &&
      year.endsAt >= now
  }
}

// List subscription years for the current institution
subscriptionYearsRoutes.get(
  '/',
  requireTenantUser,
  requireRoles(UserRole.DIRECTOR, UserRole.CENTRAL_ADMIN, UserRole.ADMINISTRATION),
  asyncHandler(async (req, res) => {
    const years = await prisma.subscriptionYear.findMany({
      where: { institutionId: req.institutionId! },
      orderBy: { startsAt: 'asc' }
    })
    res.json({ years: years.map(decorateSubscriptionYear) })
  })
)

// Purchase 1-10 school years
subscriptionYearsRoutes.post(
  '/purchase',
  requireTenantUser,
  requireRoles(UserRole.DIRECTOR, UserRole.CENTRAL_ADMIN),
  validate(z.object({
    body: z.object({
      yearsCount: z.number().int().min(1).max(10),
      firstYearLabel: z.string().min(1),
      firstYearStartsAt: z.coerce.date(),
    })
  })),
  asyncHandler(async (req, res) => {
    const { yearsCount, firstYearLabel, firstYearStartsAt } = req.body
    const institutionId = req.institutionId!

    const [subscription, institution] = await Promise.all([
      prisma.subscription.findFirst({
        where: { institutionId, status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] } },
        include: { plan: true },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.institution.findUnique({ where: { id: institutionId }, select: { currency: true } })
    ])

    const amountDuePerYear = subscription?.plan?.annualPrice ?? 100_000

    const created: object[] = []
    const createdIds: string[] = []
    const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000

    for (let i = 0; i < yearsCount; i++) {
      const startsAt = new Date(firstYearStartsAt.getTime() + i * YEAR_MS)
      const endsAt = new Date(firstYearStartsAt.getTime() + (i + 1) * YEAR_MS - 1)

      const [startYearStr, endYearStr] = firstYearLabel.split('-')
      const startYear = parseInt(startYearStr) + i
      const endYear = parseInt(endYearStr || String(parseInt(startYearStr) + 1)) + i
      const yearLabel = `${startYear}-${endYear}`

      const existing = await prisma.subscriptionYear.findUnique({
        where: { institutionId_schoolYearLabel: { institutionId, schoolYearLabel: yearLabel } }
      })

      if (existing) {
        created.push(decorateSubscriptionYear(existing))
        continue
      }

      const year = await prisma.subscriptionYear.create({
        data: {
          institutionId,
          subscriptionId: subscription?.id,
          schoolYearLabel: yearLabel,
          startsAt,
          endsAt,
          status: SubscriptionYearStatus.PENDING_PAYMENT,
          amountDue: amountDuePerYear,
        }
      })
      createdIds.push(year.id)
      await ensureAcademicYearForSubscriptionYear({
        institutionId,
        schoolYearLabel: yearLabel,
        startsAt,
        endsAt,
        activate: false
      })
      created.push(decorateSubscriptionYear(year))
    }

    let invoice: Awaited<ReturnType<typeof createSaaSInvoice>> | null = null
    if (createdIds.length > 0 && subscription?.id && subscription.plan) {
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 15)
      invoice = await createSaaSInvoice({
        institutionId,
        subscriptionId: subscription.id,
        planId: subscription.plan.id,
        amount: amountDuePerYear * createdIds.length,
        currency: institution?.currency ?? 'XOF',
        dueDate,
        notes: `Abonnement par année scolaire : ${createdIds.length} année(s) à ${amountDuePerYear.toLocaleString('fr-FR')} XOF/an`
      })
      await prisma.subscriptionYear.updateMany({
        where: { id: { in: createdIds } },
        data: { invoiceRef: invoice.number }
      })
    }

    await prisma.auditLog.create({
      data: {
        institutionId,
        actorId: req.user!.id,
        action: 'SUBSCRIPTION_YEARS_PURCHASED',
        entity: 'SubscriptionYear',
        entityId: institutionId,
        metadata: { yearsCount, firstYearLabel, amountDuePerYear, invoiceNumber: invoice?.number }
      }
    })

    res.status(201).json({ ok: true, years: created, invoice })
  })
)

// Mark a subscription year as active/paid
subscriptionYearsRoutes.post(
  '/:id/pay',
  requireRoles(UserRole.SUPER_ADMIN),
  validate(z.object({
    body: z.object({
      amountPaid: z.number().int().positive(),
      invoiceRef: z.string().optional(),
    })
  })),
  asyncHandler(async (req, res) => {
    const year = await prisma.subscriptionYear.findUnique({ where: { id: req.params.id } })
    if (!year) throw notFound('Année d\'abonnement introuvable')

    if (
      (req.user!.role === UserRole.DIRECTOR || req.user!.role === UserRole.CENTRAL_ADMIN) &&
      year.institutionId !== req.institutionId
    ) {
      throw forbidden('Accès refusé')
    }

    const nextPaidAmount = Math.min(year.amountDue, year.amountPaid + req.body.amountPaid)
    const isFullyPaid = nextPaidAmount >= year.amountDue
    const updated = await prisma.subscriptionYear.update({
      where: { id: req.params.id },
      data: {
        status: isFullyPaid ? SubscriptionYearStatus.ACTIVE : SubscriptionYearStatus.PENDING_PAYMENT,
        amountPaid: nextPaidAmount,
        invoiceRef: req.body.invoiceRef ?? year.invoiceRef,
        paidAt: isFullyPaid ? new Date() : year.paidAt,
      }
    })

    // If this year covers today, activate the institution
    const now = new Date()
    if (isFullyPaid) {
      await ensureAcademicYearForSubscriptionYear({
        institutionId: updated.institutionId,
        schoolYearLabel: updated.schoolYearLabel,
        startsAt: updated.startsAt,
        endsAt: updated.endsAt,
        activate: updated.startsAt <= now && updated.endsAt >= now
      })
    }
    if (updated.invoiceRef) {
      await syncSubscriptionYearsForInvoicePayment({
        institutionId: updated.institutionId,
        invoiceNumber: updated.invoiceRef,
        paidAmount: nextPaidAmount,
        actorId: req.user!.id
      })
    }

    await prisma.auditLog.create({
      data: {
        institutionId: updated.institutionId,
        actorId: req.user!.id,
        action: isFullyPaid ? 'SUBSCRIPTION_YEAR_PAID' : 'SUBSCRIPTION_YEAR_PARTIAL_PAYMENT',
        entity: 'SubscriptionYear',
        entityId: updated.id,
        metadata: {
          paymentAmount: req.body.amountPaid,
          cumulativePaid: nextPaidAmount,
          amountDue: updated.amountDue,
          remainingAmount: Math.max(0, updated.amountDue - nextPaidAmount),
          invoiceRef: req.body.invoiceRef
        }
      }
    })

    res.json({ year: decorateSubscriptionYear(updated), payment: { amountPaid: req.body.amountPaid, cumulativePaid: nextPaidAmount, fullyPaid: isFullyPaid } })
  })
)

// Cancel a subscription year (super admin only)
subscriptionYearsRoutes.post(
  '/:id/cancel',
  requireRoles(UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const year = await prisma.subscriptionYear.findUnique({ where: { id: req.params.id } })
    if (!year) throw notFound('Année d\'abonnement introuvable')

    const updated = await prisma.subscriptionYear.update({
      where: { id: req.params.id },
      data: { status: SubscriptionYearStatus.CANCELED }
    })

    await prisma.auditLog.create({
      data: {
        institutionId: updated.institutionId,
        actorId: req.user!.id,
        action: 'SUBSCRIPTION_YEAR_CANCELED',
        entity: 'SubscriptionYear',
        entityId: updated.id,
        metadata: { previousStatus: year.status, schoolYearLabel: year.schoolYearLabel }
      }
    })

    res.json({ year: decorateSubscriptionYear(updated) })
  })
)

// Super admin: list all subscription years across institutions
subscriptionYearsRoutes.get(
  '/admin/all',
  requireRoles(UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { institutionId, status } = req.query
    const years = await prisma.subscriptionYear.findMany({
      where: {
        ...(institutionId ? { institutionId: String(institutionId) } : {}),
        ...(status ? { status: status as SubscriptionYearStatus } : {}),
      },
      include: {
        institution: { select: { id: true, name: true, countryCode: true } }
      },
      orderBy: [{ institutionId: 'asc' }, { startsAt: 'asc' }]
    })
    res.json({ years: years.map(decorateSubscriptionYear) })
  })
)

// Summary for current institution
subscriptionYearsRoutes.get(
  '/summary',
  requireTenantUser,
  requireRoles(UserRole.DIRECTOR, UserRole.CENTRAL_ADMIN, UserRole.ADMINISTRATION),
  asyncHandler(async (req, res) => {
    const now = new Date()
    const institutionId = req.institutionId!

    const allYears = await prisma.subscriptionYear.findMany({
      where: { institutionId },
      orderBy: { startsAt: 'asc' }
    })

    const activeYear = allYears.find((year) =>
      year.status === SubscriptionYearStatus.ACTIVE &&
      year.startsAt <= now &&
      year.endsAt >= now
    ) ?? null

    const expiredYear = [...allYears]
      .filter((year) => year.endsAt < now)
      .sort((a, b) => b.endsAt.getTime() - a.endsAt.getTime())[0] ?? null

    const nextYear = [...allYears]
      .filter((year) => year.endsAt >= now && (!activeYear || year.id !== activeYear.id))
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0] ?? null

    const totalPaid = allYears
      .reduce((sum, year) => sum + year.amountPaid, 0)

    const totalDue = allYears.reduce((sum, year) => sum + year.amountDue, 0)

    res.json({
      summary: {
        total: allYears.length,
        years: allYears.map(decorateSubscriptionYear),
        allYears: allYears.map(decorateSubscriptionYear),
        activeYear: activeYear ? decorateSubscriptionYear(activeYear) : null,
        expiredYear: expiredYear ? decorateSubscriptionYear(expiredYear) : null,
        nextYear: nextYear ? decorateSubscriptionYear(nextYear) : null,
        totalPaid,
        totalDue,
        remainingAmount: Math.max(0, totalDue - totalPaid),
        isCurrentlyActive: !!activeYear
      }
    })
  })
)
