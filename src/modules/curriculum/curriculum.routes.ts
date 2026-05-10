import { Router } from 'express'
import { z } from 'zod'
import { CurriculumCycle, InstitutionKind, UserRole } from '@prisma/client'
import { prisma } from '../../config/prisma'
import { asyncHandler } from '../../lib/async'
import { notFound } from '../../lib/errors'
import { authenticate } from '../../middlewares/auth'
import { requireRoles } from '../../middlewares/rbac'
import { validate } from '../../middlewares/validate'

export const curriculumRoutes = Router()
curriculumRoutes.use(authenticate)

const superAdminOnly = requireRoles(UserRole.SUPER_ADMIN)

// List curricula — visible to all authenticated users
curriculumRoutes.get(
  '/',
  asyncHandler(async (req, res) => {
    const { countryCode, institutionKind, cycle } = req.query
    const curricula = await prisma.curriculum.findMany({
      where: {
        ...(countryCode ? { countryCode: String(countryCode) } : {}),
        ...(institutionKind ? { institutionKind: institutionKind as InstitutionKind } : {}),
        ...(cycle ? { cycle: cycle as CurriculumCycle } : {}),
      },
      include: { subjects: { orderBy: { order: 'asc' } } },
      orderBy: [{ countryCode: 'asc' }, { cycle: 'asc' }, { name: 'asc' }]
    })
    res.json({ curricula })
  })
)

curriculumRoutes.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const curriculum = await prisma.curriculum.findUnique({
      where: { id: req.params.id },
      include: { subjects: { orderBy: { order: 'asc' } } }
    })
    if (!curriculum) throw notFound('Curriculum introuvable')
    res.json({ curriculum })
  })
)

const curriculumBody = z.object({
  body: z.object({
    countryCode: z.string().optional(),
    institutionId: z.string().optional(),
    institutionKind: z.nativeEnum(InstitutionKind),
    cycle: z.nativeEnum(CurriculumCycle),
    gradeLevelCode: z.string().optional(),
    name: z.string().min(1),
    description: z.string().optional(),
    passingAverage: z.number().positive().optional(),
    maxScore: z.number().positive().optional(),
    termCount: z.number().int().positive().optional(),
    isOfficial: z.boolean().optional(),
    isActive: z.boolean().optional().default(true),
  })
})

curriculumRoutes.post(
  '/',
  superAdminOnly,
  validate(curriculumBody),
  asyncHandler(async (req, res) => {
    const curriculum = await prisma.curriculum.create({ data: req.body })
    await prisma.auditLog.create({
      data: {
        institutionId: curriculum.institutionId,
        actorId: req.user?.id,
        action: 'CURRICULUM_CREATED',
        entity: 'Curriculum',
        entityId: curriculum.id,
        ip: req.ip,
        metadata: { newValue: curriculum }
      }
    })
    res.status(201).json({ curriculum })
  })
)

curriculumRoutes.patch(
  '/:id',
  superAdminOnly,
  validate(z.object({ body: curriculumBody.shape.body.partial() })),
  asyncHandler(async (req, res) => {
    const previous = await prisma.curriculum.findUnique({ where: { id: req.params.id } })
    if (!previous) throw notFound('Curriculum introuvable')
    const curriculum = await prisma.curriculum.update({
      where: { id: req.params.id },
      data: req.body
    })
    await prisma.auditLog.create({
      data: {
        institutionId: curriculum.institutionId,
        actorId: req.user?.id,
        action: 'CURRICULUM_UPDATED',
        entity: 'Curriculum',
        entityId: curriculum.id,
        ip: req.ip,
        metadata: { oldValue: previous, newValue: curriculum }
      }
    })
    res.json({ curriculum })
  })
)

curriculumRoutes.delete(
  '/:id',
  superAdminOnly,
  asyncHandler(async (req, res) => {
    const previous = await prisma.curriculum.findUnique({ where: { id: req.params.id } })
    if (!previous) throw notFound('Curriculum introuvable')
    await prisma.curriculum.delete({ where: { id: req.params.id } })
    await prisma.auditLog.create({
      data: {
        institutionId: previous.institutionId,
        actorId: req.user?.id,
        action: 'CURRICULUM_DELETED',
        entity: 'Curriculum',
        entityId: previous.id,
        ip: req.ip,
        metadata: { oldValue: previous }
      }
    })
    res.json({ ok: true })
  })
)

// Subjects within a curriculum
const subjectBody = z.object({
  body: z.object({
    name: z.string().min(1),
    code: z.string().optional(),
    weeklyHours: z.number().positive().optional().default(1),
    coefficient: z.number().positive().optional().default(1),
    isCompulsory: z.boolean().optional().default(true),
    order: z.number().int().optional().default(0),
  })
})

curriculumRoutes.post(
  '/:id/subjects',
  superAdminOnly,
  validate(subjectBody),
  asyncHandler(async (req, res) => {
    const subject = await prisma.curriculumSubject.create({
      data: { curriculumId: req.params.id, ...req.body }
    })
    await prisma.auditLog.create({
      data: {
        actorId: req.user?.id,
        action: 'CURRICULUM_SUBJECT_CREATED',
        entity: 'CurriculumSubject',
        entityId: subject.id,
        ip: req.ip,
        metadata: { curriculumId: req.params.id, newValue: subject }
      }
    })
    res.status(201).json({ subject })
  })
)

curriculumRoutes.patch(
  '/:id/subjects/:subjectId',
  superAdminOnly,
  validate(z.object({ body: subjectBody.shape.body.partial() })),
  asyncHandler(async (req, res) => {
    const previous = await prisma.curriculumSubject.findUnique({ where: { id: req.params.subjectId } })
    if (!previous) throw notFound('Matière de programme introuvable')
    const subject = await prisma.curriculumSubject.update({
      where: { id: req.params.subjectId },
      data: req.body
    })
    await prisma.auditLog.create({
      data: {
        actorId: req.user?.id,
        action: 'CURRICULUM_SUBJECT_UPDATED',
        entity: 'CurriculumSubject',
        entityId: subject.id,
        ip: req.ip,
        metadata: { curriculumId: req.params.id, oldValue: previous, newValue: subject }
      }
    })
    res.json({ subject })
  })
)

curriculumRoutes.delete(
  '/:id/subjects/:subjectId',
  superAdminOnly,
  asyncHandler(async (req, res) => {
    const previous = await prisma.curriculumSubject.findUnique({ where: { id: req.params.subjectId } })
    if (!previous) throw notFound('Matière de programme introuvable')
    await prisma.curriculumSubject.delete({ where: { id: req.params.subjectId } })
    await prisma.auditLog.create({
      data: {
        actorId: req.user?.id,
        action: 'CURRICULUM_SUBJECT_DELETED',
        entity: 'CurriculumSubject',
        entityId: previous.id,
        ip: req.ip,
        metadata: { curriculumId: req.params.id, oldValue: previous }
      }
    })
    res.json({ ok: true })
  })
)

// Country config — readable by all, writable by super admin only
// Note: CountryConfig.code is the primary key
curriculumRoutes.get(
  '/countries/config',
  asyncHandler(async (_req, res) => {
    const countries = await prisma.countryConfig.findMany({ orderBy: { code: 'asc' } })
    res.json({ countries })
  })
)

curriculumRoutes.get(
  '/countries/:code',
  asyncHandler(async (req, res) => {
    const country = await prisma.countryConfig.findUnique({
      where: { code: req.params.code.toUpperCase() }
    })
    if (!country) throw notFound('Pays introuvable')
    res.json({ country })
  })
)

curriculumRoutes.patch(
  '/countries/:code',
  superAdminOnly,
  asyncHandler(async (req, res) => {
    const code = req.params.code.toUpperCase()
    const previous = await prisma.countryConfig.findUnique({ where: { code } })
    const country = await prisma.countryConfig.upsert({
      where: { code },
      create: { code, name: code, nameFr: code, educationCycles: [], ...req.body },
      update: req.body,
    })
    await prisma.auditLog.create({
      data: {
        actorId: req.user?.id,
        action: 'COUNTRY_RULE_UPDATED',
        entity: 'CountryConfig',
        entityId: country.code,
        ip: req.ip,
        metadata: { oldValue: previous, newValue: country }
      }
    })
    res.json({ country })
  })
)
