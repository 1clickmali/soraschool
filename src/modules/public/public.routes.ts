import { Router } from 'express'
import { z } from 'zod'
import { InstitutionStatus, PlanTier } from '@prisma/client'
import { prisma } from '../../config/prisma'
import { asyncHandler } from '../../lib/async'
import { badRequest } from '../../lib/errors'
import { writeAuditLog } from '../../lib/audit'
import { validate } from '../../middlewares/validate'

export const publicRoutes = Router()

const planPrices: Record<'BASIC' | 'PREMIUM', { code: string; installationFee: number; annualPrice: number }> = {
  BASIC: { code: 'BASIC', installationFee: 200_000, annualPrice: 100_000 },
  PREMIUM: { code: 'PREMIUM', installationFee: 300_000, annualPrice: 500_000 }
}

function normalizeLookup(value: string) {
  return value.trim().toLowerCase()
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 64)
}

publicRoutes.get(
  '/schools/resolve',
  asyncHandler(async (req, res) => {
    const query = normalizeLookup(String(req.query.query ?? req.query.code ?? req.query.slug ?? ''))
    if (!query) throw badRequest('Code ou nom école requis')

    const institution = await prisma.institution.findFirst({
      where: {
        OR: [
          { slug: query },
          { code: query },
          { name: { contains: query, mode: 'insensitive' } }
        ],
        status: { not: InstitutionStatus.DELETED }
      },
      select: {
        id: true,
        name: true,
        slug: true,
        code: true,
        status: true,
        logoUrl: true,
        country: true,
        city: true,
        phone: true,
        email: true,
        activeAcademicYearName: true,
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { plan: true }
        }
      }
    })

    if (!institution) throw badRequest('École introuvable. Vérifiez le code fourni par votre établissement.')

    await writeAuditLog({
      institutionId: institution.id,
      action: 'PUBLIC_SCHOOL_RESOLVED',
      entity: 'Institution',
      entityId: institution.id,
      metadata: { query },
      req
    })

    res.json({ institution })
  })
)

publicRoutes.post(
  '/plan-orders',
  validate(
    z.object({
      body: z.object({
        plan: z.enum(['BASIC', 'PREMIUM']),
        schoolName: z.string().min(2),
        city: z.string().optional(),
        country: z.string().optional(),
        contactName: z.string().min(2),
        phone: z.string().min(6),
        email: z.string().email().optional(),
        whatsapp: z.string().optional(),
        message: z.string().optional()
      })
    })
  ),
  asyncHandler(async (req, res) => {
    const plan = req.body.plan as 'BASIC' | 'PREMIUM'
    const prices = planPrices[plan]
    const order = await prisma.publicPlanOrder.create({
      data: {
        planTier: plan as PlanTier,
        planCode: prices.code,
        schoolName: req.body.schoolName.trim(),
        schoolSlug: slugify(req.body.schoolName),
        city: req.body.city?.trim() || null,
        country: req.body.country?.trim() || "Côte d'Ivoire",
        contactName: req.body.contactName.trim(),
        phone: req.body.phone.trim(),
        email: req.body.email?.trim() || null,
        whatsapp: req.body.whatsapp?.trim() || null,
        message: req.body.message?.trim() || null,
        installationFee: prices.installationFee,
        annualPrice: prices.annualPrice,
        totalFirstYear: prices.installationFee + prices.annualPrice
      }
    })

    await writeAuditLog({
      action: 'PUBLIC_PLAN_ORDER_CREATED',
      entity: 'PublicPlanOrder',
      entityId: order.id,
      metadata: { plan, phone: order.phone, idempotencyKey: req.get('Idempotency-Key') },
      req
    })

    res.status(201).json({
      order,
      message: 'Demande d’achat reçue. SoraSchool vous contactera pour finaliser la facture et le paiement.'
    })
  })
)
