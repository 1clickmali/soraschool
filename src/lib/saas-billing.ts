import { BillingCycle } from '@prisma/client'
import { prisma } from '../config/prisma'
import { logger } from './logger'

export function computePeriodMonths(cycle: BillingCycle, schoolYears: number, schoolYearMonths: number): number {
  switch (cycle) {
    case BillingCycle.MONTHLY: return 1
    case BillingCycle.SCHOOL_YEAR: return schoolYearMonths * schoolYears
    case BillingCycle.ANNUAL: return 12 * schoolYears
    case BillingCycle.MULTI_YEAR: return 12 * schoolYears
    default: return 1
  }
}

export function computeDiscount(plan: {
  yearDiscountPercent: number
  twoYearDiscountPercent: number
  fiveYearDiscountPercent: number
  tenYearDiscountPercent: number
}, schoolYears: number, cycle: BillingCycle): number {
  if (cycle === BillingCycle.MONTHLY) return 0
  if (schoolYears >= 10) return plan.tenYearDiscountPercent
  if (schoolYears >= 5) return plan.fiveYearDiscountPercent
  if (schoolYears >= 2) return plan.twoYearDiscountPercent
  if (cycle === BillingCycle.ANNUAL || cycle === BillingCycle.SCHOOL_YEAR) return plan.yearDiscountPercent
  return 0
}

export function computeAmount(
  plan: { monthlyPrice: number; annualPrice: number; schoolYearMonths: number },
  cycle: BillingCycle,
  schoolYears: number,
  discountPercent: number
): number {
  let base: number
  switch (cycle) {
    case BillingCycle.MONTHLY:
      base = plan.monthlyPrice
      break
    case BillingCycle.SCHOOL_YEAR:
      base = plan.annualPrice > 0
        ? plan.annualPrice * schoolYears
        : plan.monthlyPrice * plan.schoolYearMonths * schoolYears
      break
    case BillingCycle.ANNUAL:
      base = plan.annualPrice * schoolYears
      break
    case BillingCycle.MULTI_YEAR:
      base = plan.annualPrice * schoolYears
      break
    default:
      base = plan.monthlyPrice
  }
  if (discountPercent > 0) {
    base = Math.round(base * (1 - discountPercent / 100))
  }
  return base
}

export async function generateInvoiceNumber(institutionId: string): Promise<string> {
  const year = new Date().getFullYear()
  const last = await prisma.saaSInvoice.findFirst({
    where: { institutionId },
    orderBy: { number: 'desc' },
    select: { number: true }
  })
  const lastSeq = last ? (parseInt(last.number.split('-').pop() ?? '0', 10) || 0) : 0
  return `INV-SAAS-${year}-${String(lastSeq + 1).padStart(5, '0')}`
}

export async function createSaaSInvoice(params: {
  institutionId: string
  subscriptionId: string
  planId: string
  amount: number
  currency: string
  dueDate: Date
  notes?: string
  installationFee?: number
}) {
  const number = await generateInvoiceNumber(params.institutionId)
  const totalAmount = params.amount + (params.installationFee ?? 0)
  const invoice = await prisma.saaSInvoice.create({
    data: {
      institutionId: params.institutionId,
      subscriptionId: params.subscriptionId,
      planId: params.planId,
      number,
      amount: totalAmount,
      currency: params.currency,
      status: 'ISSUED',
      dueDate: params.dueDate,
      notes: params.notes ?? (params.installationFee
        ? `Frais d'installation : ${params.installationFee.toLocaleString('fr-FR')} XOF + Abonnement annuel : ${params.amount.toLocaleString('fr-FR')} XOF`
        : undefined),
    }
  })
  logger.info({ invoiceId: invoice.id, institutionId: params.institutionId }, '[Billing] Facture SaaS créée')
  return invoice
}

export async function markInvoicePaid(invoiceId: string, paymentId?: string) {
  const invoice = await prisma.saaSInvoice.update({
    where: { id: invoiceId },
    data: { status: 'PAID', paidAt: new Date() }
  })
  logger.info({ invoiceId, paymentId }, '[Billing] Facture SaaS marquée PAYÉE')
  return invoice
}

export async function processExpiredTrials() {
  const now = new Date()
  const expired = await prisma.institution.findMany({
    where: {
      status: 'TRIAL',
      trialEndsAt: { lt: now }
    },
    select: { id: true, name: true }
  })

  for (const inst of expired) {
    await prisma.institution.update({
      where: { id: inst.id },
      data: { status: 'PENDING_PAYMENT' }
    })
    logger.info({ institutionId: inst.id, name: inst.name }, '[Trial] Essai expiré → PENDING_PAYMENT')
  }
  return { processed: expired.length }
}

export async function processExpiredSubscriptions() {
  const now = new Date()
  const expired = await prisma.subscription.findMany({
    where: {
      autoSuspend: true,
      endsAt: { lt: now },
      status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] }
    },
    select: { id: true, institutionId: true }
  })

  for (const sub of expired) {
    await prisma.$transaction([
      prisma.subscription.update({ where: { id: sub.id }, data: { status: 'EXPIRED' } }),
      prisma.institution.update({ where: { id: sub.institutionId }, data: { status: 'EXPIRED' } })
    ])
    logger.info({ subscriptionId: sub.id, institutionId: sub.institutionId }, '[Subscription] Abonnement expiré')
  }

  // Mark overdue invoices
  await prisma.saaSInvoice.updateMany({
    where: {
      status: 'ISSUED',
      dueDate: { lt: now }
    },
    data: { status: 'OVERDUE' }
  })

  return { expired: expired.length }
}
