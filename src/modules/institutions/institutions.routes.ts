import { Router } from 'express'
import { z } from 'zod'
import { UserRole } from '@prisma/client'
import { prisma } from '../../config/prisma'
import { asyncHandler } from '../../lib/async'
import { forbidden, notFound } from '../../lib/errors'
import { authenticate, optionalAuthenticate } from '../../middlewares/auth'
import { requireRoles, requireTenantUser } from '../../middlewares/rbac'
import { validate } from '../../middlewares/validate'

export const institutionsRoutes = Router()

const assetPathSchema = z
  .string()
  .trim()
  .refine((value) => value.startsWith('/api/documents/') || /^https?:\/\//.test(value), {
    message: 'URL ou chemin document invalide'
  })

institutionsRoutes.get(
  '/slug/:slug',
  optionalAuthenticate,
  asyncHandler(async (req, res) => {
    const institution = await prisma.institution.findUnique({
      where: { slug: req.params.slug },
      select: {
        id: true,
        name: true,
        slug: true,
        kind: true,
        structure: true,
        status: true,
        logoUrl: true,
        country: true,
        city: true,
        district: true,
        address: true,
        phone: true,
        whatsapp: true,
        email: true,
        website: true,
        directorName: true,
        centralAdminName: true,
        motto: true,
        languages: true,
        levels: true,
        activeAcademicYearName: true,
        currency: true,
        primaryColor: true,
        secondaryColor: true,
        accentColor: true
      }
    })
    if (!institution) throw notFound('Établissement introuvable')
    res.json({ institution })
  })
)

institutionsRoutes.get(
  '/settings',
  authenticate,
  requireTenantUser,
  asyncHandler(async (req, res) => {
    const institution = await prisma.institution.findUnique({ where: { id: req.institutionId! } })
    res.json({ institution })
  })
)

// ─── ABONNEMENT DU DIRECTEUR ──────────────────────────────────────────────────

institutionsRoutes.get(
  '/my-subscription',
  authenticate,
  requireTenantUser,
  asyncHandler(async (req, res) => {
    const institutionId = req.institutionId!
    const [institution, subscription, invoices, payments] = await Promise.all([
      prisma.institution.findUnique({
        where: { id: institutionId },
        select: { id: true, name: true, status: true, trialEndsAt: true }
      }),
      prisma.subscription.findFirst({
        where: { institutionId },
        orderBy: { createdAt: 'desc' },
        include: { plan: true }
      }),
      prisma.saaSInvoice.findMany({
        where: { institutionId },
        orderBy: { createdAt: 'desc' },
        take: 20
      }),
      prisma.saaSPayment.findMany({
        where: { institutionId, status: 'PAID' },
        orderBy: { createdAt: 'desc' }
      })
    ])
    if (!institution) throw notFound('Institution introuvable')

    const totalBilled = invoices.reduce((s, i) => s + i.amount, 0)
    const totalPaid = payments.reduce((s, p) => s + p.amount, 0)
    const remaining = Math.max(0, totalBilled - totalPaid)

    res.json({
      institution,
      subscription,
      invoices,
      payments,
      summary: { totalBilled, totalPaid, remaining }
    })
  })
)

// ─── GESTION DU PERSONNEL (COMPTABLE / SECRÉTARIAT) ──────────────────────────

institutionsRoutes.get(
  '/staff',
  authenticate,
  requireTenantUser,
  requireRoles(UserRole.DIRECTOR, UserRole.CENTRAL_ADMIN, UserRole.ADMINISTRATION),
  asyncHandler(async (req, res) => {
    const staff = await prisma.user.findMany({
      where: {
        institutionId: req.institutionId!,
        role: { in: [UserRole.ACCOUNTANT, UserRole.SECRETARIAT, UserRole.ADMINISTRATION, UserRole.DIRECTOR, UserRole.TEACHER, UserRole.STOCK_MANAGER] },
        isActive: true
      },
      select: { id: true, firstName: true, lastName: true, phone: true, email: true, role: true, createdAt: true, lastLoginAt: true },
      orderBy: { role: 'asc' }
    })
    res.json({ staff })
  })
)

institutionsRoutes.patch(
  '/staff/:userId/role',
  authenticate,
  requireTenantUser,
  requireRoles(UserRole.DIRECTOR),
  asyncHandler(async (req, res) => {
    const { role } = req.body as { role: string }
    const assignableRoles: UserRole[] = [UserRole.ACCOUNTANT, UserRole.SECRETARIAT, UserRole.ADMINISTRATION, UserRole.TEACHER, UserRole.STOCK_MANAGER]
    if (!assignableRoles.includes(role as UserRole)) throw forbidden(`Rôle non assignable: ${role}`)
    const user = await prisma.user.findFirst({ where: { id: req.params.userId, institutionId: req.institutionId! } })
    if (!user) throw notFound('Utilisateur introuvable dans cet établissement')
    if (user.role === UserRole.DIRECTOR) throw forbidden('Impossible de modifier le rôle d\'un autre Directeur')
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { role: role as UserRole },
      select: { id: true, firstName: true, lastName: true, phone: true, role: true }
    })
    res.json({ user: updated })
  })
)

// ─── PARAMÈTRES ───────────────────────────────────────────────────────────────

institutionsRoutes.patch(
  '/settings',
  authenticate,
  requireTenantUser,
  requireRoles(UserRole.CENTRAL_ADMIN, UserRole.DIRECTOR, UserRole.ADMINISTRATION),
  validate(
    z.object({
      body: z.object({
        logoUrl: assetPathSchema.optional(),
        sealUrl: assetPathSchema.optional(),
        signatureUrl: assetPathSchema.optional(),
        name: z.string().min(2).optional(),
        motto: z.string().optional(),
        phone: z.string().optional(),
        whatsapp: z.string().optional(),
        email: z.string().email().optional(),
        address: z.string().optional(),
        website: z.string().url().optional(),
        directorName: z.string().optional(),
        activeAcademicYearName: z.string().optional(),
        currency: z.string().optional(),
        primaryColor: z.string().optional(),
        secondaryColor: z.string().optional(),
        accentColor: z.string().optional(),
        languages: z.array(z.string()).optional(),
        levels: z.array(z.string()).optional()
      })
    })
  ),
  asyncHandler(async (req, res) => {
    const institution = await prisma.institution.update({
      where: { id: req.institutionId! },
      data: req.body
    })
    res.json({ institution })
  })
)
