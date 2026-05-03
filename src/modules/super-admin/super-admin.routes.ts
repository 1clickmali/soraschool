import fs from 'node:fs'
import { Router } from 'express'
import slugify from 'slugify'
import { z } from 'zod'
import {
  BillingCycle,
  InstitutionKind,
  InstitutionStructure,
  InstitutionStatus,
  PaymentProvider,
  PaymentStatus,
  PlanTier,
  SubscriptionStatus,
  UserRole
} from '@prisma/client'
import { prisma } from '../../config/prisma'
import { asyncHandler } from '../../lib/async'
import { badRequest, notFound } from '../../lib/errors'
import { normalizePhone } from '../../lib/security'
import { assertEstablishmentCapacity, defaultPlanForTier, DEFAULT_PLANS, ensureDefaultPlans } from '../../lib/plan-limits'
import { authenticate } from '../../middlewares/auth'
import { requireRoles } from '../../middlewares/rbac'
import { validate } from '../../middlewares/validate'
import { audit } from '../../middlewares/audit'
import { resolveStoragePath, safeDownloadName, storageKeyFromPath, upload } from '../../lib/storage'
import { renderInstitutionInstallationContractPdf, renderSaaSInvoicePdf } from '../pdf/pdf.service'
import {
  getPlatformBranding,
  platformAssetUrl,
  PLATFORM_BRANDING_ID,
  toPublicPlatformBranding
} from '../../lib/platform-branding'
import { sendReminderSms } from '../../lib/sms'
import {
  createSaaSInvoice,
  computeAmount,
  computeDiscount,
  computePeriodMonths,
  markInvoicePaid,
  processExpiredTrials,
  processExpiredSubscriptions
} from '../../lib/saas-billing'
import { seedCountryConfigs, COUNTRY_CONFIGS } from '../../lib/country-education'

export const superAdminRoutes = Router()

superAdminRoutes.use(authenticate, requireRoles(UserRole.SUPER_ADMIN))

const planSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    code: z.string().min(2).optional(),
    tier: z.nativeEnum(PlanTier),
    monthlyPrice: z.number().int().nonnegative().default(0),
    annualPrice: z.number().int().nonnegative().default(0),
    maxStudents: z.number().int().positive().optional(),
    maxTeachers: z.number().int().positive().optional(),
    maxEstablishments: z.number().int().positive().default(1),
    canCreateBranches: z.boolean().default(false),
    features: z.unknown().optional()
  })
})

const allowedPhoneSchema = z.object({
  body: z.object({
    institutionId: z.string(),
    phone: z.string().min(6),
    role: z.nativeEnum(UserRole),
    name: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().email().optional()
  })
})

const superAdminUserSchema = z.object({
  body: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    phone: z.string().min(6),
    email: z.string().email().optional()
  })
})

const brandingAssetSchema = z
  .string()
  .trim()
  .refine((value) => value.startsWith('/api/platform/assets') || value.startsWith('/icons/') || /^https?:\/\//.test(value), {
    message: 'URL ou asset plateforme invalide'
  })

const platformBrandingSchema = z.object({
  body: z.object({
    appName: z.string().min(2).optional(),
    slogan: z.string().optional(),
    logoUrl: brandingAssetSchema.nullable().optional(),
    faviconUrl: brandingAssetSchema.nullable().optional(),
    supportEmail: z.string().email().optional(),
    supportPhone: z.string().optional(),
    supportAddress: z.string().optional(),
    website: z.string().url().optional().or(z.literal('')),
    primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional()
  })
})

const establishmentSchema = z.object({
  params: z.object({ id: z.string() }),
  body: z.object({
    name: z.string().min(2),
    slug: z.string().optional(),
    kind: z.nativeEnum(InstitutionKind).optional(),
    country: z.string().optional(),
    city: z.string().optional(),
    district: z.string().optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    logoUrl: z.string().url().optional(),
    directorName: z.string().optional(),
    directorPhone: z.string().optional(),
    directorEmail: z.string().email().optional(),
    motto: z.string().optional(),
    levels: z.array(z.string()).default([]),
    activeAcademicYearName: z.string().optional()
  })
})

const createInstitutionSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    slug: z.string().optional(),
    kind: z.nativeEnum(InstitutionKind).default(InstitutionKind.OTHER),
    logoUrl: z.string().url().optional(),
    sealUrl: z.string().url().optional(),
    signatureUrl: z.string().url().optional(),
    country: z.string().default("Côte d'Ivoire"),
    city: z.string().optional(),
    district: z.string().optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
    whatsapp: z.string().optional(),
    email: z.string().email().optional(),
    website: z.string().url().optional(),
    directorName: z.string().min(2).optional(),
    directorPhone: z.string().min(6).optional(),
    directorEmail: z.string().email().optional(),
    centralAdminName: z.string().min(2).optional(),
    centralAdminPhone: z.string().min(6).optional(),
    centralAdminEmail: z.string().email().optional(),
    motto: z.string().optional(),
    languages: z.array(z.string()).default(['FR']),
    levels: z.array(z.string()).default([]),
    estimatedStudents: z.number().int().nonnegative().optional(),
    estimatedTeachers: z.number().int().nonnegative().optional(),
    activeAcademicYearName: z.string().optional(),
    currency: z.string().default('XOF'),
    planId: z.string(),
    billingCycle: z.nativeEnum(BillingCycle).default(BillingCycle.MONTHLY),
    schoolYears: z.number().int().positive().default(1),
    subscriptionStartsAt: z.coerce.date().optional(),
    subscriptionEndsAt: z.coerce.date().optional(),
    status: z.nativeEnum(InstitutionStatus).default(InstitutionStatus.TRIAL),
    primaryColor: z.string().default('#064E3B'),
    secondaryColor: z.string().default('#F7F1DE'),
    accentColor: z.string().default('#C89B3C')
  })
})

const updateInstitutionSchema = z.object({
  params: z.object({ id: z.string() }),
  body: z.object({
    name: z.string().min(2).optional(),
    kind: z.nativeEnum(InstitutionKind).optional(),
    logoUrl: z.string().url().optional(),
    sealUrl: z.string().url().optional(),
    signatureUrl: z.string().url().optional(),
    country: z.string().optional(),
    city: z.string().optional(),
    district: z.string().optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
    whatsapp: z.string().optional(),
    email: z.string().email().optional(),
    website: z.string().url().optional(),
    directorName: z.string().optional(),
    directorPhone: z.string().optional(),
    directorEmail: z.string().email().optional(),
    centralAdminName: z.string().optional(),
    centralAdminPhone: z.string().optional(),
    centralAdminEmail: z.string().email().optional(),
    motto: z.string().optional(),
    activeAcademicYearName: z.string().optional(),
    currency: z.string().optional(),
    primaryColor: z.string().optional(),
    secondaryColor: z.string().optional(),
    accentColor: z.string().optional(),
    languages: z.array(z.string()).optional(),
    levels: z.array(z.string()).optional()
  })
})

function buildSlug(name: string, customSlug?: string) {
  return slugify(customSlug ?? name, { lower: true, strict: true })
}

function buildPlanCode(name: string, customCode?: string) {
  return slugify(customCode ?? name, { lower: false, strict: true }).replace(/-/g, '_').toUpperCase()
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/)
  return {
    firstName: parts[0] ?? 'Directeur',
    lastName: parts.slice(1).join(' ') || 'Établissement'
  }
}

function requireField(value: string | undefined, label: string) {
  if (!value?.trim()) throw badRequest(`${label} est requis`)
  return value.trim()
}

superAdminRoutes.get(
  '/dashboard',
  asyncHandler(async (_req, res) => {
    const now = new Date()
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startYear = new Date(now.getFullYear(), 0, 1)
    const seriesStart = new Date(now.getFullYear(), now.getMonth() - 11, 1)

    const [
      totalInstitutions,
      activeInstitutions,
      suspendedInstitutions,
      expiredSubscriptions,
      pendingSaaSPayments,
      totalStudents,
      totalTeachers,
      monthlyRevenue,
      annualRevenue,
      recentInstitutions,
      institutionsByStatus,
      monthlyPayments
    ] = await Promise.all([
      prisma.institution.count({ where: { status: { not: InstitutionStatus.DELETED } } }),
      prisma.institution.count({ where: { status: InstitutionStatus.ACTIVE } }),
      prisma.institution.count({ where: { status: InstitutionStatus.SUSPENDED } }),
      prisma.subscription.count({ where: { endsAt: { lt: now }, status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] } } }),
      prisma.saaSPayment.count({ where: { status: PaymentStatus.PENDING } }),
      prisma.student.count(),
      prisma.teacher.count(),
      prisma.saaSPayment.aggregate({ where: { status: PaymentStatus.PAID, paidAt: { gte: startMonth } }, _sum: { amount: true } }),
      prisma.saaSPayment.aggregate({ where: { status: PaymentStatus.PAID, paidAt: { gte: startYear } }, _sum: { amount: true } }),
      prisma.institution.findMany({
        where: { status: { not: InstitutionStatus.DELETED } },
        include: { subscriptions: { include: { plan: true }, orderBy: { createdAt: 'desc' }, take: 1 } },
        orderBy: { createdAt: 'desc' },
        take: 5
      }),
      prisma.institution.groupBy({
        by: ['status'],
        where: { status: { not: InstitutionStatus.DELETED } },
        _count: { _all: true }
      }),
      prisma.saaSPayment.findMany({
        where: { status: PaymentStatus.PAID, paidAt: { gte: seriesStart } },
        select: { amount: true, paidAt: true }
      })
    ])

    const monthFormatter = new Intl.DateTimeFormat('fr-FR', { month: 'short' })
    const monthlyRevenueSeries = Array.from({ length: 12 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (11 - index), 1)
      const monthPayments = monthlyPayments.filter((payment) => {
        const paidAt = payment.paidAt
        return paidAt && paidAt.getFullYear() === date.getFullYear() && paidAt.getMonth() === date.getMonth()
      })
      return {
        month: monthFormatter.format(date).replace('.', ''),
        revenue: monthPayments.reduce((sum, payment) => sum + payment.amount, 0),
        subscriptions: monthPayments.length
      }
    })

    res.json({
      totalInstitutions,
      activeInstitutions,
      suspendedInstitutions,
      expiredSubscriptions,
      pendingSaaSPayments,
      totalStudents,
      totalTeachers,
      monthlyRevenue: monthlyRevenue._sum.amount ?? 0,
      annualRevenue: annualRevenue._sum.amount ?? 0,
      recentInstitutions,
      institutionsByStatus: institutionsByStatus.map((item) => ({ status: item.status, count: item._count._all })),
      monthlyRevenueSeries
    })
  })
)

superAdminRoutes.get(
  '/platform-branding',
  asyncHandler(async (_req, res) => {
    const branding = await getPlatformBranding()
    res.json({ branding: toPublicPlatformBranding(branding) })
  })
)

superAdminRoutes.patch(
  '/platform-branding',
  validate(platformBrandingSchema),
  audit('UPDATE', 'PlatformBranding'),
  asyncHandler(async (req, res) => {
    const branding = await prisma.platformBranding.upsert({
      where: { id: PLATFORM_BRANDING_ID },
      update: {
        ...req.body,
        website: req.body.website || null
      },
      create: {
        id: PLATFORM_BRANDING_ID,
        appName: req.body.appName ?? 'SoraSchool',
        slogan: req.body.slogan ?? 'La plateforme scolaire intelligente',
        logoUrl: req.body.logoUrl ?? null,
        faviconUrl: req.body.faviconUrl ?? null,
        supportEmail: req.body.supportEmail ?? 'contact@soratech.ci',
        supportPhone: req.body.supportPhone ?? '0704928068',
        supportAddress: req.body.supportAddress ?? null,
        website: req.body.website || null,
        primaryColor: req.body.primaryColor ?? '#0F6BFF',
        secondaryColor: req.body.secondaryColor ?? '#07111F',
        accentColor: req.body.accentColor ?? '#F5B941'
      }
    })
    res.json({ branding: toPublicPlatformBranding(branding) })
  })
)

superAdminRoutes.post(
  '/platform-branding/:field(logo|favicon)',
  upload.single('file'),
  audit('UPLOAD', 'PlatformBranding'),
  asyncHandler(async (req, res) => {
    const file = req.file as Express.Multer.File | undefined
    if (!file) throw badRequest('Aucun fichier reçu')
    const fileKey = storageKeyFromPath(file.path)
    const url = platformAssetUrl(fileKey)
    const field = req.params.field === 'favicon' ? 'faviconUrl' : 'logoUrl'
    const branding = await prisma.platformBranding.upsert({
      where: { id: PLATFORM_BRANDING_ID },
      update: { [field]: url },
      create: {
        id: PLATFORM_BRANDING_ID,
        appName: 'SoraSchool',
        slogan: 'La plateforme scolaire intelligente',
        logoUrl: field === 'logoUrl' ? url : null,
        faviconUrl: field === 'faviconUrl' ? url : null,
        supportEmail: 'contact@soratech.ci',
        supportPhone: '0704928068',
        primaryColor: '#0F6BFF',
        secondaryColor: '#07111F',
        accentColor: '#F5B941'
      }
    })
    res.json({ branding: toPublicPlatformBranding(branding), url })
  })
)

superAdminRoutes.get(
  '/plans',
  asyncHandler(async (_req, res) => {
    await ensureDefaultPlans()
    const codes = DEFAULT_PLANS.map((plan) => plan.code)
    const plans = await prisma.plan.findMany({
      where: { code: { in: codes }, isActive: true },
      orderBy: { monthlyPrice: 'asc' }
    })
    res.json({ plans })
  })
)

superAdminRoutes.post(
  '/plans/sync-defaults',
  audit('SYNC_DEFAULTS', 'Plan'),
  asyncHandler(async (_req, res) => {
    const plans = await ensureDefaultPlans()
    res.json({ plans })
  })
)

superAdminRoutes.post(
  '/plans',
  validate(planSchema),
  audit('CREATE', 'Plan'),
  asyncHandler(async (req, res) => {
    await ensureDefaultPlans()
    const tierDefaults = defaultPlanForTier(req.body.tier)
    const data = {
        ...req.body,
        ...(tierDefaults ?? {}),
        name: tierDefaults?.name ?? req.body.name,
        code: buildPlanCode(tierDefaults?.name ?? req.body.name, tierDefaults?.code ?? req.body.code)
      }
    const plan = await prisma.plan.upsert({
      where: { code: data.code },
      update: data,
      create: data
    })
    res.status(201).json({ plan })
  })
)

superAdminRoutes.get(
  '/institutions',
  asyncHandler(async (_req, res) => {
    const institutions = await prisma.institution.findMany({
      where: { status: { not: InstitutionStatus.DELETED } },
      include: { subscriptions: { include: { plan: true }, orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { createdAt: 'desc' }
    })
    res.json({ institutions })
  })
)

superAdminRoutes.post(
  '/institutions',
  validate(createInstitutionSchema),
  audit('CREATE', 'Institution'),
  asyncHandler(async (req, res) => {
    await ensureDefaultPlans()
    const plan = await prisma.plan.findUnique({ where: { id: req.body.planId } })
    if (!plan) throw badRequest('Plan introuvable')

    const isEnterprise = plan.tier === PlanTier.ENTERPRISE
    const slug = buildSlug(req.body.name, req.body.slug)
    const centralAdminName = isEnterprise ? requireField(req.body.centralAdminName ?? req.body.directorName, 'Le nom de l’administrateur central') : undefined
    const centralAdminPhone = isEnterprise ? normalizePhone(requireField(req.body.centralAdminPhone ?? req.body.directorPhone, 'Le téléphone de l’administrateur central')) : undefined
    const directorName = !isEnterprise ? requireField(req.body.directorName, 'Le nom du directeur') : undefined
    const directorPhone = !isEnterprise ? normalizePhone(requireField(req.body.directorPhone, 'Le téléphone du directeur')) : undefined
    const centralAdmin = centralAdminName ? splitName(centralAdminName) : null
    const director = directorName ? splitName(directorName) : null
    const startsAt = req.body.subscriptionStartsAt ?? new Date()
    const schoolYears = req.body.schoolYears ?? 1
    const endsAt =
      req.body.subscriptionEndsAt ??
      (() => {
        const months = computePeriodMonths(req.body.billingCycle, schoolYears, plan.schoolYearMonths)
        const d = new Date(startsAt)
        d.setMonth(d.getMonth() + months)
        return d
      })()
    const trialEndsAt = req.body.status === InstitutionStatus.TRIAL
      ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      : null

    let createdSubscriptionId = ''

    const institution = await prisma.$transaction(async (tx) => {
      const created = await tx.institution.create({
        data: {
          name: req.body.name,
          slug,
          kind: req.body.kind,
          structure: isEnterprise ? InstitutionStructure.CENTRAL_ADMINISTRATION : InstitutionStructure.SINGLE_SCHOOL,
          trialEndsAt,
          status: req.body.status,
          logoUrl: req.body.logoUrl,
          sealUrl: req.body.sealUrl,
          signatureUrl: req.body.signatureUrl,
          country: req.body.country,
          city: req.body.city,
          district: req.body.district,
          address: req.body.address,
          phone: req.body.phone,
          whatsapp: req.body.whatsapp,
          email: req.body.email,
          website: req.body.website,
          directorName,
          directorPhone,
          directorEmail: req.body.directorEmail,
          centralAdminName,
          centralAdminPhone,
          centralAdminEmail: req.body.centralAdminEmail,
          motto: req.body.motto,
          languages: req.body.languages,
          levels: req.body.levels,
          estimatedStudents: req.body.estimatedStudents,
          estimatedTeachers: req.body.estimatedTeachers,
          activeAcademicYearName: req.body.activeAcademicYearName,
          currency: req.body.currency,
          primaryColor: req.body.primaryColor,
          secondaryColor: req.body.secondaryColor,
          accentColor: req.body.accentColor
        }
      })

      const sub = await tx.subscription.create({
        data: {
          institutionId: created.id,
          planId: plan.id,
          cycle: req.body.billingCycle,
          schoolYears,
          periodMonths: computePeriodMonths(req.body.billingCycle, schoolYears, plan.schoolYearMonths),
          discountPercent: computeDiscount(plan, schoolYears, req.body.billingCycle),
          startsAt,
          endsAt,
          trialEndsAt,
          status: req.body.status === InstitutionStatus.TRIAL ? SubscriptionStatus.TRIALING : SubscriptionStatus.ACTIVE
        }
      })
      createdSubscriptionId = sub.id

      // Auto-create an active academic year so the school can immediately create classes/students
      const yearName = req.body.activeAcademicYearName || '2025-2026'
      const [startYearStr, endYearStr] = yearName.split('-')
      const startYear = parseInt(startYearStr, 10) || new Date().getFullYear()
      const endYear = parseInt(endYearStr, 10) || startYear + 1
      await tx.academicYear.create({
        data: {
          institutionId: created.id,
          name: yearName,
          startsAt: new Date(`${startYear}-09-01`),
          endsAt: new Date(`${endYear}-06-30`),
          isActive: true
        }
      })

      if (isEnterprise && centralAdmin && centralAdminPhone) {
        await tx.allowedPhone.create({
          data: {
            institutionId: created.id,
            phone: centralAdminPhone,
            role: UserRole.CENTRAL_ADMIN,
            firstName: centralAdmin.firstName,
            lastName: centralAdmin.lastName,
            email: req.body.centralAdminEmail,
            createdById: req.user!.id
          }
        })

        await tx.user.create({
          data: {
            institutionId: created.id,
            role: UserRole.CENTRAL_ADMIN,
            firstName: centralAdmin.firstName,
            lastName: centralAdmin.lastName,
            phone: centralAdminPhone,
            email: req.body.centralAdminEmail,
            isActive: true
          }
        })

        return created
      }

      if (!director || !directorPhone) return created

      await tx.establishment.create({
        data: {
          institutionId: created.id,
          name: req.body.name,
          slug: 'principal',
          kind: req.body.kind,
          status: InstitutionStatus.ACTIVE,
          country: req.body.country,
          city: req.body.city,
          district: req.body.district,
          address: req.body.address,
          phone: req.body.phone,
          email: req.body.email,
          logoUrl: req.body.logoUrl,
          directorName,
          directorPhone,
          directorEmail: req.body.directorEmail,
          motto: req.body.motto,
          levels: req.body.levels,
          activeAcademicYearName: req.body.activeAcademicYearName
        }
      }).then(async (establishment) => {
        const directorUser = await tx.user.create({
          data: {
            institutionId: created.id,
            establishmentId: establishment.id,
            role: UserRole.DIRECTOR,
            firstName: director.firstName,
            lastName: director.lastName,
            phone: directorPhone,
            email: req.body.directorEmail,
            isActive: true
          }
        })

        await tx.establishmentDirectorAssignment.create({
          data: {
            institutionId: created.id,
            establishmentId: establishment.id,
            directorUserId: directorUser.id,
            assignedById: req.user!.id,
            note: 'Directeur initial du plan mono-école'
          }
        })
      })

      await tx.allowedPhone.create({
        data: {
          institutionId: created.id,
          phone: directorPhone,
          role: UserRole.DIRECTOR,
          firstName: director.firstName,
          lastName: director.lastName,
          email: req.body.directorEmail,
          createdById: req.user!.id
        }
      })

      return created
    })

    // Auto-generate SaaS invoice for non-trial institutions
    if (req.body.status !== InstitutionStatus.TRIAL && createdSubscriptionId) {
      const discountPercent = computeDiscount(plan, schoolYears, req.body.billingCycle)
      const amount = computeAmount(plan, req.body.billingCycle, schoolYears, discountPercent)
      if (amount > 0) {
        const dueDate = new Date()
        dueDate.setDate(dueDate.getDate() + 15)
        await createSaaSInvoice({
          institutionId: institution.id,
          subscriptionId: createdSubscriptionId,
          planId: plan.id,
          amount,
          currency: req.body.currency,
          dueDate,
          notes: `Abonnement ${plan.name}`,
        })
      }
    }

    res.status(201).json({ institution })
  })
)

superAdminRoutes.patch(
  '/institutions/:id/subscription',
  validate(
    z.object({
      params: z.object({ id: z.string() }),
      body: z.object({
        planId: z.string(),
        billingCycle: z.nativeEnum(BillingCycle),
        status: z.nativeEnum(InstitutionStatus).optional(),
        schoolYears: z.number().int().positive().default(1),
        generateInvoice: z.boolean().default(false)
      })
    })
  ),
  audit('UPDATE_PLAN', 'Institution'),
  asyncHandler(async (req, res) => {
    const institution = await prisma.institution.findFirst({ where: { id: req.params.id } })
    if (!institution) throw notFound('Institution introuvable')

    const plan = await prisma.plan.findFirst({ where: { id: req.body.planId, isActive: true } })
    if (!plan) throw badRequest('Plan introuvable ou inactif')

    const schoolYears = req.body.schoolYears ?? 1
    const startsAt = new Date()
    const months = computePeriodMonths(req.body.billingCycle, schoolYears, plan.schoolYearMonths)
    const endsAt = new Date(startsAt)
    endsAt.setMonth(endsAt.getMonth() + months)

    const newStatus = req.body.status ?? institution.status

    // Update or create subscription
    const existingSub = await prisma.subscription.findFirst({
      where: { institutionId: institution.id },
      orderBy: { createdAt: 'desc' }
    })

    let sub
    if (existingSub) {
      sub = await prisma.subscription.update({
        where: { id: existingSub.id },
        data: {
          planId: plan.id,
          cycle: req.body.billingCycle,
          schoolYears,
          periodMonths: months,
          discountPercent: computeDiscount(plan, schoolYears, req.body.billingCycle),
          startsAt,
          endsAt,
          status: newStatus === InstitutionStatus.TRIAL ? SubscriptionStatus.TRIALING
            : newStatus === InstitutionStatus.ACTIVE ? SubscriptionStatus.ACTIVE
            : SubscriptionStatus.CANCELED
        }
      })
    } else {
      sub = await prisma.subscription.create({
        data: {
          institutionId: institution.id,
          planId: plan.id,
          cycle: req.body.billingCycle,
          schoolYears,
          periodMonths: months,
          discountPercent: computeDiscount(plan, schoolYears, req.body.billingCycle),
          startsAt,
          endsAt,
          status: newStatus === InstitutionStatus.ACTIVE ? SubscriptionStatus.ACTIVE : SubscriptionStatus.TRIALING
        }
      })
    }

    // Update institution status and plan reference
    await prisma.institution.update({
      where: { id: institution.id },
      data: { status: newStatus }
    })

    // Optionally generate a new invoice
    if (req.body.generateInvoice) {
      const discountPercent = computeDiscount(plan, schoolYears, req.body.billingCycle)
      const amount = computeAmount(plan, req.body.billingCycle, schoolYears, discountPercent)
      if (amount > 0) {
        const dueDate = new Date()
        dueDate.setDate(dueDate.getDate() + 15)
        await createSaaSInvoice({
          institutionId: institution.id,
          subscriptionId: sub.id,
          planId: plan.id,
          amount,
          currency: institution.currency || 'XOF',
          dueDate,
          notes: `Changement de plan → ${plan.name} (${req.body.billingCycle})`
        })
      }
    }

    res.json({ ok: true, subscriptionId: sub.id })
  })
)

superAdminRoutes.get(
  '/institutions/:id/installation-contract',
  asyncHandler(async (req, res) => {
    const buffer = await renderInstitutionInstallationContractPdf(req.params.id, String(req.query.lang ?? 'FR'))
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="fiche-contrat-installation-${req.params.id}.pdf"`)
    res.send(buffer)
  })
)

superAdminRoutes.get(
  '/institutions/:id/establishments',
  asyncHandler(async (req, res) => {
    const institution = await prisma.institution.findFirst({
      where: { id: req.params.id, status: { not: InstitutionStatus.DELETED } },
      include: { subscriptions: { include: { plan: true }, orderBy: { createdAt: 'desc' }, take: 1 } }
    })
    if (!institution) throw notFound('Institution introuvable')
    const establishments = await prisma.establishment.findMany({
      where: { institutionId: institution.id },
      orderBy: [{ createdAt: 'asc' }, { name: 'asc' }]
    })
    res.json({ institution, establishments })
  })
)

superAdminRoutes.post(
  '/institutions/:id/establishments',
  validate(establishmentSchema),
  audit('CREATE', 'Establishment'),
  asyncHandler(async (req, res) => {
    const institution = await prisma.institution.findFirst({
      where: { id: req.params.id, status: { not: InstitutionStatus.DELETED } }
    })
    if (!institution) throw notFound('Institution introuvable')
    await assertEstablishmentCapacity(institution.id)
    const slug = buildSlug(req.body.name, req.body.slug)
    const directorPhone = req.body.directorPhone ? normalizePhone(req.body.directorPhone) : undefined
    const director = req.body.directorName ? splitName(req.body.directorName) : null
    const establishment = await prisma.$transaction(async (tx) => {
      const created = await tx.establishment.create({
        data: {
          institutionId: institution.id,
          name: req.body.name,
          slug,
          kind: req.body.kind ?? institution.kind,
          status: InstitutionStatus.ACTIVE,
          logoUrl: req.body.logoUrl,
          country: req.body.country ?? institution.country,
          city: req.body.city ?? institution.city,
          district: req.body.district ?? institution.district,
          address: req.body.address,
          phone: req.body.phone,
          email: req.body.email,
          directorName: req.body.directorName,
          directorPhone,
          directorEmail: req.body.directorEmail,
          motto: req.body.motto,
          levels: req.body.levels,
          activeAcademicYearName: req.body.activeAcademicYearName
        }
      })

      if (director && directorPhone) {
        const user = await tx.user.upsert({
          where: { institutionId_phone: { institutionId: institution.id, phone: directorPhone } },
          update: {
            establishmentId: created.id,
            role: UserRole.DIRECTOR,
            firstName: director.firstName,
            lastName: director.lastName,
            email: req.body.directorEmail,
            isActive: true
          },
          create: {
            institutionId: institution.id,
            establishmentId: created.id,
            role: UserRole.DIRECTOR,
            firstName: director.firstName,
            lastName: director.lastName,
            phone: directorPhone,
            email: req.body.directorEmail,
            isActive: true
          }
        })
        await tx.allowedPhone.upsert({
          where: { institutionId_phone: { institutionId: institution.id, phone: directorPhone } },
          update: { role: UserRole.DIRECTOR, firstName: director.firstName, lastName: director.lastName, email: req.body.directorEmail },
          create: {
            institutionId: institution.id,
            phone: directorPhone,
            role: UserRole.DIRECTOR,
            firstName: director.firstName,
            lastName: director.lastName,
            email: req.body.directorEmail,
            createdById: req.user!.id
          }
        })
        await tx.establishmentDirectorAssignment.create({
          data: {
            institutionId: institution.id,
            establishmentId: created.id,
            directorUserId: user.id,
            assignedById: req.user!.id,
            note: 'Directeur nommé par le Super Admin'
          }
        })
      }
      return created
    })
    res.status(201).json({ establishment })
  })
)

superAdminRoutes.get(
  '/payments',
  asyncHandler(async (req, res) => {
    const institutionId = typeof req.query.institutionId === 'string' ? req.query.institutionId : undefined
    const payments = await prisma.saaSPayment.findMany({
      where: { institutionId },
      include: {
        institution: { select: { id: true, name: true, slug: true } },
        subscription: { include: { plan: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 200
    })
    res.json({ payments })
  })
)

// ── SaaS Invoices ──────────────────────────────────────────────────────────────

superAdminRoutes.get(
  '/saas-invoices',
  asyncHandler(async (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined
    const invoices = await prisma.saaSInvoice.findMany({
      where: {
        ...(status ? { status: status as any } : {}),
        ...(search ? { institution: { name: { contains: search, mode: 'insensitive' } } } : {})
      },
      include: {
        institution: { select: { id: true, name: true, slug: true } },
        plan: { select: { name: true } },
        subscription: { select: { cycle: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 200
    })
    res.json({ invoices })
  })
)

const markPaidSchema = z.object({
  params: z.object({ id: z.string() }),
  body: z.object({
    provider: z.nativeEnum(PaymentProvider),
    transactionRef: z.string().optional()
  })
})

superAdminRoutes.post(
  '/saas-invoices/:id/mark-paid',
  validate(markPaidSchema),
  audit('MARK_PAID', 'SaaSInvoice'),
  asyncHandler(async (req, res) => {
    const invoice = await prisma.saaSInvoice.findUnique({
      where: { id: req.params.id }
    })
    if (!invoice) throw notFound('Facture introuvable')
    if (invoice.status === 'PAID') throw badRequest('Cette facture est déjà payée')
    if (invoice.status === 'CANCELED') throw badRequest('Cette facture est annulée')

    const [updatedInvoice] = await prisma.$transaction([
      prisma.saaSInvoice.update({
        where: { id: invoice.id },
        data: { status: 'PAID', paidAt: new Date() }
      }),
      prisma.saaSPayment.create({
        data: {
          institutionId: invoice.institutionId,
          subscriptionId: invoice.subscriptionId ?? undefined,
          invoiceId: invoice.id,
          amount: invoice.amount,
          currency: invoice.currency,
          provider: req.body.provider,
          transactionRef: req.body.transactionRef ?? null,
          status: PaymentStatus.PAID,
          paidAt: new Date()
        }
      }),
      ...(invoice.subscriptionId
        ? [prisma.subscription.update({
            where: { id: invoice.subscriptionId },
            data: { status: SubscriptionStatus.ACTIVE, lastPaymentAt: new Date() }
          }),
          prisma.institution.update({
            where: { id: invoice.institutionId },
            data: { status: InstitutionStatus.ACTIVE }
          })]
        : [])
    ])
    res.json({ invoice: updatedInvoice })
  })
)

superAdminRoutes.post(
  '/saas-invoices/:id/send-reminder',
  audit('SEND_REMINDER', 'SaaSInvoice'),
  asyncHandler(async (req, res) => {
    const invoice = await prisma.saaSInvoice.findUnique({
      where: { id: req.params.id },
      include: { institution: { select: { id: true, name: true, directorPhone: true, email: true } } }
    })
    if (!invoice) throw notFound('Facture introuvable')
    if (invoice.status === 'PAID') throw badRequest('Cette facture est déjà payée')

    await prisma.saaSInvoice.update({
      where: { id: invoice.id },
      data: { reminderSentAt: new Date() }
    })

    const branding = await getPlatformBranding()
    const phone = invoice.institution.directorPhone
    if (phone) {
      await sendReminderSms(phone, invoice.number, invoice.amount, invoice.currency, branding.appName)
    }

    res.json({ ok: true, sentAt: new Date() })
  })
)

superAdminRoutes.get(
  '/saas-invoices/:id/pdf',
  asyncHandler(async (req, res) => {
    const buffer = await renderSaaSInvoicePdf(req.params.id)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="facture-saas-${req.params.id}.pdf"`)
    res.send(buffer)
  })
)

// ── Super Admins ────────────────────────────────────────────────────────────────

superAdminRoutes.post(
  '/super-admins',
  validate(superAdminUserSchema),
  audit('UPSERT', 'SuperAdmin'),
  asyncHandler(async (req, res) => {
    const phone = normalizePhone(req.body.phone)
    const existing = await prisma.user.findFirst({ where: { phone, role: UserRole.SUPER_ADMIN } })
    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: {
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            email: req.body.email,
            role: UserRole.SUPER_ADMIN,
            institutionId: null,
            establishmentId: null,
            isActive: true
          }
        })
      : await prisma.user.create({
          data: {
            role: UserRole.SUPER_ADMIN,
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            phone,
            email: req.body.email,
            isActive: true
          }
        })
    res.status(existing ? 200 : 201).json({ user })
  })
)

superAdminRoutes.get(
  '/users-summary',
  asyncHandler(async (req, res) => {
    const institutionId = typeof req.query.institutionId === 'string' ? req.query.institutionId : undefined
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    const [totalUsers, activeUsers, activeToday, roleCounts, institutions, allowedPhones] = await Promise.all([
      prisma.user.count({ where: { institutionId } }),
      prisma.user.count({ where: { institutionId, isActive: true } }),
      prisma.user.count({ where: { institutionId, lastLoginAt: { gte: startOfDay } } }),
      prisma.user.groupBy({
        by: ['role'],
        where: { institutionId },
        _count: { _all: true }
      }),
      prisma.institution.count({ where: { id: institutionId, status: { not: InstitutionStatus.DELETED } } }),
      prisma.allowedPhone.count({ where: { institutionId } })
    ])

    res.json({
      totalUsers,
      activeUsers,
      activeToday,
      institutions,
      allowedPhones,
      roles: roleCounts.map((item) => ({
        role: item.role,
        count: item._count._all
      }))
    })
  })
)

superAdminRoutes.get(
  '/allowed-phones',
  asyncHandler(async (req, res) => {
    const institutionId = typeof req.query.institutionId === 'string' ? req.query.institutionId : undefined
    const allowedPhones = await prisma.allowedPhone.findMany({
      where: { institutionId },
      include: { institution: { select: { id: true, name: true, slug: true } } },
      orderBy: { createdAt: 'desc' }
    })
    const users = allowedPhones.length
      ? await prisma.user.findMany({
          where: {
            OR: allowedPhones.map((allowed) => ({
              institutionId: allowed.institutionId,
              phone: allowed.phone
            }))
          },
          select: { institutionId: true, phone: true, isActive: true }
        })
      : []
    const activeByPhone = new Map(users.map((user) => [`${user.institutionId}:${user.phone}`, user.isActive]))
    res.json({
      allowedPhones: allowedPhones.map((allowed) => ({
        ...allowed,
        active: activeByPhone.get(`${allowed.institutionId}:${allowed.phone}`) ?? true
      }))
    })
  })
)

superAdminRoutes.post(
  '/allowed-phones',
  validate(allowedPhoneSchema),
  audit('UPSERT', 'AllowedPhone'),
  asyncHandler(async (req, res) => {
    const institution = await prisma.institution.findFirst({
      where: { id: req.body.institutionId, status: { not: InstitutionStatus.DELETED } },
      select: { id: true }
    })
    if (!institution) throw badRequest('Institution introuvable')

    const phone = normalizePhone(req.body.phone)
    const providedName = req.body.name ?? `${req.body.firstName ?? ''} ${req.body.lastName ?? ''}`.trim()
    const names = splitName(providedName || 'Utilisateur SoraSchool')
    const firstName = req.body.firstName ?? names.firstName
    const lastName = req.body.lastName ?? names.lastName

    const allowedPhone = await prisma.$transaction(async (tx) => {
      const allowed = await tx.allowedPhone.upsert({
        where: { institutionId_phone: { institutionId: institution.id, phone } },
        update: {
          role: req.body.role,
          firstName,
          lastName,
          email: req.body.email
        },
        create: {
          institutionId: institution.id,
          phone,
          role: req.body.role,
          firstName,
          lastName,
          email: req.body.email,
          createdById: req.user!.id
        }
      })
      await tx.user.updateMany({
        where: { institutionId: institution.id, phone },
        data: { isActive: true, role: req.body.role, firstName, lastName, email: req.body.email }
      })
      return allowed
    })

    res.status(201).json({ allowedPhone })
  })
)

superAdminRoutes.delete(
  '/allowed-phones/:id',
  audit('REVOKE', 'AllowedPhone'),
  asyncHandler(async (req, res) => {
    const allowedPhone = await prisma.allowedPhone.findUnique({ where: { id: req.params.id } })
    if (!allowedPhone) throw notFound('Accès introuvable')
    await prisma.$transaction([
      prisma.allowedPhone.delete({ where: { id: allowedPhone.id } }),
      prisma.user.updateMany({
        where: { institutionId: allowedPhone.institutionId, phone: allowedPhone.phone },
        data: { isActive: false }
      })
    ])
    res.json({ ok: true })
  })
)

superAdminRoutes.get(
  '/audit-logs',
  asyncHandler(async (req, res) => {
    const institutionId = typeof req.query.institutionId === 'string' ? req.query.institutionId : undefined
    const logs = await prisma.auditLog.findMany({
      where: { institutionId },
      include: {
        actor: { select: { firstName: true, lastName: true, phone: true, role: true } },
        institution: { select: { name: true, slug: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    })
    res.json({ logs })
  })
)

superAdminRoutes.get(
  '/documents',
  asyncHandler(async (req, res) => {
    const institutionId = typeof req.query.institutionId === 'string' ? req.query.institutionId : undefined
    const documents = await prisma.document.findMany({
      where: { institutionId },
      include: { institution: { select: { id: true, name: true, slug: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200
    })
    res.json({ documents })
  })
)

superAdminRoutes.get(
  '/documents/:id/download',
  asyncHandler(async (req, res) => {
    const document = await prisma.document.findUnique({ where: { id: req.params.id } })
    if (!document) throw notFound('Document introuvable')
    const filePath = resolveStoragePath(document.fileKey)
    if (!fs.existsSync(filePath)) throw notFound('Fichier introuvable')
    res.setHeader('Content-Type', document.mimeType)
    res.download(filePath, safeDownloadName(document.title))
  })
)

superAdminRoutes.delete(
  '/documents/:id',
  audit('DELETE', 'Document'),
  asyncHandler(async (req, res) => {
    const document = await prisma.document.findUnique({ where: { id: req.params.id } })
    if (!document) throw notFound('Document introuvable')
    const filePath = resolveStoragePath(document.fileKey)
    await prisma.document.delete({ where: { id: document.id } })
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    res.json({ ok: true })
  })
)

superAdminRoutes.get(
  '/system-health',
  asyncHandler(async (_req, res) => {
    const startedAt = Date.now()
    let databaseOk = true
    try {
      await prisma.$queryRaw`SELECT 1`
    } catch {
      databaseOk = false
    }

    const dbLatency = Date.now() - startedAt
    res.json({
      uptime: process.uptime(),
      services: [
        { name: 'API Backend', status: 'ok', latency: '<1ms' },
        { name: 'Base PostgreSQL', status: databaseOk ? 'ok' : 'error', latency: `${dbLatency}ms` },
        { name: 'Stockage fichiers', status: 'ok', latency: 'local' },
        { name: 'Service SMS/OTP', status: 'configured', latency: 'selon fournisseur' }
      ]
    })
  })
)

superAdminRoutes.get(
  '/notifications',
  asyncHandler(async (_req, res) => {
    const now = new Date()
    const [pendingPayments, expiredSubscriptions, recentInstitutions] = await Promise.all([
      prisma.saaSPayment.count({ where: { status: PaymentStatus.PENDING } }),
      prisma.subscription.count({ where: { endsAt: { lt: now }, status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] } } }),
      prisma.institution.findMany({
        where: { status: { not: InstitutionStatus.DELETED } },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: { id: true, name: true, createdAt: true }
      })
    ])

    res.json({
      notifications: [
        ...recentInstitutions.map((institution) => ({
          id: `institution-${institution.id}`,
          title: 'Nouvelle institution',
          desc: `${institution.name} a été créée`,
          time: institution.createdAt,
          unread: false,
          level: 'INFO'
        })),
        pendingPayments
          ? {
              id: 'pending-payments',
              title: 'Paiements en attente',
              desc: `${pendingPayments} paiement(s) SaaS à vérifier`,
              time: now,
              unread: true,
              level: 'WARNING'
            }
          : null,
        expiredSubscriptions
          ? {
              id: 'expired-subscriptions',
              title: 'Abonnements expirés',
              desc: `${expiredSubscriptions} abonnement(s) à suspendre`,
              time: now,
              unread: true,
              level: 'DANGER'
            }
          : null
      ].filter(Boolean)
    })
  })
)

superAdminRoutes.patch(
  '/institutions/:id',
  validate(updateInstitutionSchema),
  audit('UPDATE', 'Institution'),
  asyncHandler(async (req, res) => {
    const institution = await prisma.institution.update({
      where: { id: req.params.id },
      data: req.body,
      include: { subscriptions: { include: { plan: true }, orderBy: { createdAt: 'desc' }, take: 1 } }
    })
    res.json({ institution })
  })
)

superAdminRoutes.patch(
  '/institutions/:id/status',
  zodStatusMiddleware(),
  audit('UPDATE_STATUS', 'Institution'),
  asyncHandler(async (req, res) => {
    const institution = await prisma.institution.update({
      where: { id: req.params.id },
      data: { status: req.body.status }
    })
    res.json({ institution })
  })
)

superAdminRoutes.delete(
  '/institutions/:id',
  audit('DELETE', 'Institution'),
  asyncHandler(async (req, res) => {
    await prisma.institution.update({
      where: { id: req.params.id },
      data: { status: InstitutionStatus.DELETED }
    })
    res.json({ ok: true })
  })
)

superAdminRoutes.post(
  '/subscriptions/suspend-expired',
  audit('SUSPEND_EXPIRED', 'Subscription'),
  asyncHandler(async (_req, res) => {
    const result = await suspendExpiredSubscriptions()
    res.json(result)
  })
)

superAdminRoutes.get(
  '/country-configs',
  asyncHandler(async (_req, res) => {
    res.json({
      countries: COUNTRY_CONFIGS.map((c) => ({
        code: c.code,
        name: c.name,
        nameFr: c.nameFr,
        currency: c.currency,
        language: c.language,
        schoolYearStartMonth: c.schoolYearStartMonth,
        schoolYearEndMonth: c.schoolYearEndMonth,
        educationCycles: c.educationCycles
      }))
    })
  })
)

function zodStatusMiddleware() {
  return validate(
    z.object({
      params: z.object({ id: z.string() }),
      body: z.object({ status: z.nativeEnum(InstitutionStatus) })
    })
  )
}

export async function suspendExpiredSubscriptions() {
  const now = new Date()
  const expired = await prisma.subscription.findMany({
    where: {
      autoSuspend: true,
      endsAt: { lt: now },
      status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING, SubscriptionStatus.PAST_DUE] }
    },
    select: { id: true, institutionId: true }
  })

  for (const subscription of expired) {
    await prisma.$transaction([
      prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: SubscriptionStatus.EXPIRED }
      }),
      prisma.institution.update({
        where: { id: subscription.institutionId },
        data: { status: InstitutionStatus.EXPIRED }
      })
    ])
  }

  return { suspended: expired.length }
}
