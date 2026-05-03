import { PlanTier, SubscriptionStatus } from '@prisma/client'
import { prisma } from '../config/prisma'
import { forbidden, notFound } from './errors'

export const DEFAULT_PLANS = [
  {
    name: 'Basic',
    code: 'BASIC',
    tier: PlanTier.BASIC,
    monthlyPrice: 55_000,
    annualPrice: 550_000,
    maxStudents: 300,
    maxTeachers: 25,
    maxEstablishments: 1,
    canCreateBranches: false,
    features: ['students', 'classes', 'teachers', 'attendance', 'grades', 'payments', 'documents']
  },
  {
    name: 'Premium',
    code: 'PREMIUM',
    tier: PlanTier.PREMIUM,
    monthlyPrice: 125_000,
    annualPrice: 1_250_000,
    maxStudents: 1200,
    maxTeachers: 80,
    maxEstablishments: 1,
    canCreateBranches: false,
    features: ['all_basic', 'parent_portal', 'pdf_cards', 'shop', 'messages', 'advanced_exports']
  },
  {
    name: 'Entreprise',
    code: 'ENTERPRISE',
    tier: PlanTier.ENTERPRISE,
    monthlyPrice: 200_000,
    annualPrice: 2_000_000,
    maxStudents: 2500,
    maxTeachers: null,
    maxEstablishments: 4,
    canCreateBranches: true,
    features: ['all_premium', 'multi_establishment', 'up_to_2500_students', 'unlimited_teachers', 'api_mobile', 'priority_support']
  }
] as const

export async function ensureDefaultPlans() {
  return Promise.all(
    DEFAULT_PLANS.map((plan) =>
      prisma.plan.upsert({
        where: { code: plan.code },
        update: { ...plan, isActive: true },
        create: { ...plan, isActive: true }
      })
    )
  )
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
    throw forbidden('La création de filiales est réservée au plan Entreprise')
  }
  const count = await prisma.establishment.count({ where: { institutionId } })
  if (plan.maxEstablishments && count >= plan.maxEstablishments) {
    throw forbidden(`Limite du plan ${plan.name} atteinte : ${plan.maxEstablishments} établissements maximum`)
  }
  return plan
}
