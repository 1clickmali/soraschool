import { PlanTier, SubscriptionStatus } from '@prisma/client'
import { prisma } from '../config/prisma'
import { forbidden, notFound } from './errors'

export const DEFAULT_PLANS = [
  {
    name: 'Basic',
    code: 'BASIC',
    tier: PlanTier.BASIC,
    installationFee: 200_000,
    monthlyPrice: 0,
    annualPrice: 100_000,
    maxStudents: null,
    maxTeachers: null,
    maxEstablishments: 1,
    canCreateBranches: false,
    features: [
      'students', 'classes', 'teachers', 'attendance', 'grades',
      'payments', 'documents', 'schedule', 'discipline', 'messages',
      'reports', 'notifications', 'shop'
    ]
  },
  {
    name: 'Premium',
    code: 'PREMIUM',
    tier: PlanTier.PREMIUM,
    installationFee: 300_000,
    monthlyPrice: 0,
    annualPrice: 500_000,
    maxStudents: null,
    maxTeachers: null,
    maxEstablishments: 10,
    canCreateBranches: true,
    features: [
      'all_basic', 'multi_establishment', 'group_dashboard',
      'consolidated_reports', 'multi_direction'
    ]
  }
] as const

export async function ensureDefaultPlans() {
  const results = await Promise.all(
    DEFAULT_PLANS.map((plan) =>
      prisma.plan.upsert({
        where: { code: plan.code },
        update: { ...plan, isActive: true },
        create: { ...plan, isActive: true }
      })
    )
  )

  // Deactivate Enterprise and any other legacy plans
  await prisma.plan.updateMany({
    where: { code: { notIn: DEFAULT_PLANS.map(p => p.code) } },
    data: { isActive: false }
  })

  const planByCode = new Map(results.map((plan) => [plan.code, plan]))
  const legacySubscriptions = await prisma.subscription.findMany({
    where: {
      status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING, SubscriptionStatus.PAST_DUE] },
      plan: { code: { notIn: DEFAULT_PLANS.map((plan) => plan.code) } }
    },
    include: {
      plan: { select: { code: true, canCreateBranches: true } },
      institution: { select: { structure: true } }
    }
  })

  if (legacySubscriptions.length > 0) {
    await Promise.all(
      legacySubscriptions.map((subscription) => {
        const targetCode =
          subscription.plan.canCreateBranches || subscription.institution.structure === 'CENTRAL_ADMINISTRATION'
            ? 'PREMIUM'
            : 'BASIC'
        const targetPlan = planByCode.get(targetCode)
        if (!targetPlan || targetPlan.id === subscription.planId) return Promise.resolve()
        return prisma.subscription.update({
          where: { id: subscription.id },
          data: { planId: targetPlan.id }
        })
      })
    )
  }

  return results
}

export function defaultPlanForTier(tier: PlanTier) {
  return DEFAULT_PLANS.find((plan) => plan.tier === tier)
}

export async function getInstitutionPlan(institutionId: string) {
  await ensureDefaultPlans()
  const subscription = await prisma.subscription.findFirst({
    where: {
      institutionId,
      status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING, SubscriptionStatus.PAST_DUE] }
    },
    include: { plan: true },
    orderBy: { createdAt: 'desc' }
  })
  if (subscription?.plan) return subscription.plan

  const basic = await prisma.plan.findUnique({ where: { code: 'BASIC' } })
  if (!basic) throw notFound('Plan Basic introuvable')
  return basic
}

export function computeFirstYearTotal(plan: { installationFee: number; annualPrice: number }) {
  return plan.installationFee + plan.annualPrice
}

export function computeRenewalAmount(plan: { annualPrice: number }) {
  return plan.annualPrice
}

export async function assertStudentCapacity(institutionId: string) {
  const plan = await getInstitutionPlan(institutionId)
  if (!plan.maxStudents) return plan
  const count = await prisma.student.count({ where: { institutionId } })
  if (count >= plan.maxStudents) {
    throw forbidden(`Limite du plan ${plan.name} atteinte : ${plan.maxStudents} élèves maximum`)
  }
  return plan
}

export async function assertTeacherCapacity(institutionId: string) {
  const plan = await getInstitutionPlan(institutionId)
  if (!plan.maxTeachers) return plan
  const count = await prisma.teacher.count({ where: { institutionId } })
  if (count >= plan.maxTeachers) {
    throw forbidden(`Limite du plan ${plan.name} atteinte : ${plan.maxTeachers} enseignants maximum`)
  }
  return plan
}

export async function assertEstablishmentCapacity(institutionId: string) {
  const plan = await getInstitutionPlan(institutionId)
  if (!plan.canCreateBranches) {
    throw forbidden('La création de plusieurs établissements est disponible uniquement avec le plan Premium.')
  }
  const count = await prisma.establishment.count({ where: { institutionId } })
  if (plan.maxEstablishments && count >= plan.maxEstablishments) {
    throw forbidden(`Limite du plan ${plan.name} atteinte : ${plan.maxEstablishments} établissements maximum`)
  }
  return plan
}
