import { Router } from 'express'
import { z } from 'zod'
import { UserRole } from '@prisma/client'
import { prisma } from '../../config/prisma'
import { asyncHandler } from '../../lib/async'
import { notFound } from '../../lib/errors'
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
