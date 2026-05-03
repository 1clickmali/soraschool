import { Router } from 'express'
import { z } from 'zod'
import { Prisma, UserRole } from '@prisma/client'
import { prisma } from '../../config/prisma'
import { asyncHandler } from '../../lib/async'
import { getScopedEstablishmentId, resolveWritableEstablishmentId } from '../../lib/access-scope'
import { badRequest, notFound } from '../../lib/errors'
import { authenticate } from '../../middlewares/auth'
import { requireRoles, requireTenantUser } from '../../middlewares/rbac'
import { validate } from '../../middlewares/validate'

export const academicsRoutes = Router()

academicsRoutes.use(authenticate, requireTenantUser)

const managementRoles = [UserRole.CENTRAL_ADMIN, UserRole.DIRECTOR, UserRole.ADMINISTRATION, UserRole.SECRETARIAT] as const
const insensitive = Prisma.QueryMode.insensitive
const CIV_GRADE_LEVELS = [
  { code: 'PS', name: 'Petite Section', order: 1 },
  { code: 'MS', name: 'Moyenne Section', order: 2 },
  { code: 'GS', name: 'Grande Section', order: 3 },
  { code: 'CP1', name: 'CP1', order: 10 },
  { code: 'CP2', name: 'CP2', order: 11 },
  { code: 'CE1', name: 'CE1', order: 12 },
  { code: 'CE2', name: 'CE2', order: 13 },
  { code: 'CM1', name: 'CM1', order: 14 },
  { code: 'CM2', name: 'CM2', order: 15 },
  { code: '6E', name: 'Sixième', order: 20 },
  { code: '5E', name: 'Cinquième', order: 21 },
  { code: '4E', name: 'Quatrième', order: 22 },
  { code: '3E', name: 'Troisième', order: 23 },
  { code: '2NDA', name: 'Seconde A', order: 30 },
  { code: '2NDC', name: 'Seconde C', order: 31 },
  { code: '1A', name: 'Première A', order: 40 },
  { code: '1C', name: 'Première C', order: 41 },
  { code: '1D', name: 'Première D', order: 42 },
  { code: 'TA', name: 'Terminale A', order: 50 },
  { code: 'TC', name: 'Terminale C', order: 51 },
  { code: 'TD', name: 'Terminale D', order: 52 },
  { code: 'G1', name: 'Technique G1', order: 60 },
  { code: 'G2', name: 'Technique G2', order: 61 },
  { code: 'BT', name: 'BT / Formation professionnelle', order: 70 }
]

async function ensureCivGradeLevels(institutionId: string) {
  const existing = await prisma.gradeLevel.findMany({
    where: { institutionId },
    select: { code: true }
  })
  const existingCodes = new Set(existing.map((level) => level.code))
  const missing = CIV_GRADE_LEVELS.filter((level) => !existingCodes.has(level.code))
  if (missing.length === 0) return
  await prisma.gradeLevel.createMany({
    data: missing.map((level) => ({ institutionId, ...level })),
    skipDuplicates: true
  })
}

academicsRoutes.get(
  '/academic-years',
  asyncHandler(async (req, res) => {
    const years = await prisma.academicYear.findMany({
      where: { institutionId: req.institutionId! },
      orderBy: { startsAt: 'desc' }
    })
    res.json({ academicYears: years })
  })
)

academicsRoutes.post(
  '/academic-years',
  requireRoles(...managementRoles),
  validate(
    z.object({
      body: z.object({
        name: z.string().min(4),
        startsAt: z.coerce.date(),
        endsAt: z.coerce.date(),
        isActive: z.boolean().default(false)
      })
    })
  ),
  asyncHandler(async (req, res) => {
    const year = await prisma.academicYear.create({
      data: { institutionId: req.institutionId!, ...req.body }
    })
    if (year.isActive) {
      await prisma.institution.update({
        where: { id: req.institutionId! },
        data: { activeAcademicYearName: year.name }
      })
    }
    res.status(201).json({ academicYear: year })
  })
)

// Maps InstitutionKind → grade level codes allowed for that kind
const KIND_ALLOWED_CODES: Record<string, string[] | null> = {
  MATERNELLE:      ['PS', 'MS', 'GS'],
  PRIMARY:         ['CP1', 'CP2', 'CE1', 'CE2', 'CM1', 'CM2', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'AN1', 'AN2', 'AN3', 'AN4', 'AN5', 'AN6'],
  COLLEGE:         ['6E', '5E', '4E', '3E', '6EME', '5EME', '4EME', '3EME', 'JHS1', 'JHS2', 'JHS3', 'JSS1', 'JSS2', 'JSS3', '7EME', '8EME', '9EME'],
  LYCEE:           ['2NDA', '2NDC', '1A', '1C', '1D', 'TA', 'TC', 'TD', '2NDE', '1ERE', 'TLE', 'SHS1', 'SHS2', 'SHS3', 'SSS1', 'SSS2', 'SSS3'],
  TRAINING_CENTER: ['G1', 'G2', 'BT'],
  GROUPE_SCOLAIRE: null,
  UNIVERSITY:      null,
  RELIGIOUS:       null,
  BILINGUAL:       null,
  OTHER:           null,
}

academicsRoutes.get(
  '/levels',
  asyncHandler(async (req, res) => {
    await ensureCivGradeLevels(req.institutionId!)

    // Optional: filter by institutionKind query param OR by the institution's kind
    let kindFilter: string | undefined = typeof req.query.kind === 'string' ? req.query.kind : undefined

    if (!kindFilter) {
      const institution = await prisma.institution.findUnique({
        where: { id: req.institutionId! },
        select: { kind: true }
      })
      kindFilter = institution?.kind ?? undefined
    }

    const allowedCodes = kindFilter ? KIND_ALLOWED_CODES[kindFilter] : null

    const levels = await prisma.gradeLevel.findMany({
      where: {
        institutionId: req.institutionId!,
        ...(allowedCodes ? { code: { in: allowedCodes } } : {})
      },
      orderBy: { order: 'asc' }
    })
    res.json({ levels })
  })
)

academicsRoutes.post(
  '/levels',
  requireRoles(...managementRoles),
  validate(
    z.object({
      body: z.object({
        code: z.string().min(1),
        name: z.string().min(1),
        order: z.number().int().default(0)
      })
    })
  ),
  asyncHandler(async (req, res) => {
    const level = await prisma.gradeLevel.create({
      data: { institutionId: req.institutionId!, ...req.body }
    })
    res.status(201).json({ level })
  })
)

academicsRoutes.get(
  '/classes',
  asyncHandler(async (req, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search : undefined
    const gradeLevelId = typeof req.query.gradeLevelId === 'string' ? req.query.gradeLevelId : undefined
    const where: Prisma.ClassroomWhereInput =
      req.user!.role === UserRole.TEACHER
        ? {
            institutionId: req.institutionId!,
            gradeLevelId,
            assignments: { some: { teacher: { userId: req.user!.id } } },
            OR: search ? [{ name: { contains: search, mode: insensitive } }] : undefined
          }
        : {
            institutionId: req.institutionId!,
            establishmentId: getScopedEstablishmentId(req),
            gradeLevelId,
            OR: search
              ? [
                  { name: { contains: search, mode: insensitive } },
                  { gradeLevel: { name: { contains: search, mode: insensitive } } }
                ]
              : undefined
          }

    const classes = await prisma.classroom.findMany({
      where,
      include: { gradeLevel: true, academicYear: true, mainTeacher: true, _count: { select: { students: true, assignments: true } } },
      orderBy: { name: 'asc' }
    })
    res.json({ classes })
  })
)

academicsRoutes.post(
  '/classes',
  requireRoles(...managementRoles),
  validate(
    z.object({
      body: z.object({
        academicYearId: z.string().optional(),
        establishmentId: z.string().optional(),
        gradeLevelId: z.string().optional(),
        levelId: z.string().optional(),
        mainTeacherId: z.string().optional(),
        name: z.string().min(1),
        capacity: z.number().int().positive().optional(),
        description: z.string().optional()
      })
    })
  ),
  asyncHandler(async (req, res) => {
    const activeYear = req.body.academicYearId
      ? null
      : await prisma.academicYear.findFirst({ where: { institutionId: req.institutionId!, isActive: true } })
    const academicYearId = req.body.academicYearId ?? activeYear?.id
    if (!academicYearId) {
      throw badRequest('Aucune année scolaire active configurée')
    }
    const classroom = await prisma.classroom.create({
      data: {
        institutionId: req.institutionId!,
        academicYearId,
        establishmentId: resolveWritableEstablishmentId(req, req.body.establishmentId),
        gradeLevelId: req.body.gradeLevelId ?? req.body.levelId,
        mainTeacherId: req.body.mainTeacherId,
        name: req.body.name,
        capacity: req.body.capacity
      }
    })
    res.status(201).json({ classroom })
  })
)

academicsRoutes.get(
  '/subjects',
  asyncHandler(async (req, res) => {
    const includeInactive = req.query.includeInactive === 'true'
    res.json({
      subjects: await prisma.subject.findMany({
        where: {
          institutionId: req.institutionId!,
          isActive: includeInactive ? undefined : true
        },
        orderBy: { name: 'asc' }
      })
    })
  })
)

academicsRoutes.post(
  '/subjects',
  requireRoles(...managementRoles),
  validate(
    z.object({
      body: z.object({
        name: z.string().min(1),
        code: z.string().optional(),
        coefficient: z.number().int().positive().default(1)
      })
    })
  ),
  asyncHandler(async (req, res) => {
    const subject = await prisma.subject.create({
      data: {
        institutionId: req.institutionId!,
        name: req.body.name.trim(),
        code: req.body.code?.trim() || undefined,
        coefficient: req.body.coefficient
      }
    })
    res.status(201).json({ subject })
  })
)

academicsRoutes.patch(
  '/subjects/:id',
  requireRoles(...managementRoles),
  validate(
    z.object({
      params: z.object({ id: z.string() }),
      body: z.object({
        name: z.string().min(1).optional(),
        code: z.string().optional().nullable(),
        coefficient: z.number().int().positive().optional(),
        isActive: z.boolean().optional()
      })
    })
  ),
  asyncHandler(async (req, res) => {
    const existing = await prisma.subject.findFirst({ where: { id: req.params.id, institutionId: req.institutionId! } })
    if (!existing) throw notFound('Matière introuvable')
    const subject = await prisma.subject.update({
      where: { id: existing.id },
      data: {
        name: req.body.name?.trim(),
        code: req.body.code === undefined ? undefined : req.body.code?.trim() || null,
        coefficient: req.body.coefficient,
        isActive: req.body.isActive
      }
    })
    res.json({ subject })
  })
)

academicsRoutes.delete(
  '/subjects/:id',
  requireRoles(...managementRoles),
  validate(z.object({ params: z.object({ id: z.string() }) })),
  asyncHandler(async (req, res) => {
    const existing = await prisma.subject.findFirst({ where: { id: req.params.id, institutionId: req.institutionId! } })
    if (!existing) throw notFound('Matière introuvable')
    await prisma.subject.update({ where: { id: existing.id }, data: { isActive: false } })
    res.json({ ok: true })
  })
)

academicsRoutes.get(
  '/assignments',
  asyncHandler(async (req, res) => {
    const assignments = await prisma.teacherAssignment.findMany({
      where:
        req.user!.role === UserRole.TEACHER
          ? { institutionId: req.institutionId!, teacher: { userId: req.user!.id } }
          : {
              institutionId: req.institutionId!,
              classroom: getScopedEstablishmentId(req) ? { establishmentId: getScopedEstablishmentId(req) } : undefined
            },
      include: { teacher: true, classroom: true, subject: true, academicYear: true },
      orderBy: { createdAt: 'desc' }
    })
    res.json({ assignments })
  })
)

academicsRoutes.post(
  '/assignments',
  requireRoles(UserRole.CENTRAL_ADMIN, UserRole.DIRECTOR, UserRole.ADMINISTRATION),
  validate(
    z.object({
      body: z.object({
        teacherId: z.string(),
        classroomId: z.string(),
        subjectId: z.string(),
        academicYearId: z.string().optional()
      })
    })
  ),
  asyncHandler(async (req, res) => {
    const [teacher, classroom, subject] = await Promise.all([
      prisma.teacher.findFirst({ where: { id: req.body.teacherId, institutionId: req.institutionId!, establishmentId: getScopedEstablishmentId(req), status: 'ACTIVE' } }),
      prisma.classroom.findFirst({ where: { id: req.body.classroomId, institutionId: req.institutionId!, establishmentId: getScopedEstablishmentId(req) } }),
      prisma.subject.findFirst({ where: { id: req.body.subjectId, institutionId: req.institutionId!, isActive: true } })
    ])
    if (!teacher) throw notFound('Enseignant introuvable')
    if (!classroom) throw notFound('Classe introuvable')
    if (!subject) throw notFound('Matière introuvable ou archivée')

    const activeYear = req.body.academicYearId
      ? await prisma.academicYear.findFirst({ where: { id: req.body.academicYearId, institutionId: req.institutionId! } })
      : await prisma.academicYear.findFirst({ where: { institutionId: req.institutionId!, isActive: true } })
    if (!activeYear) throw badRequest('Aucune année scolaire active configurée')

    const assignment = await prisma.teacherAssignment.upsert({
      where: {
        teacherId_classroomId_subjectId_academicYearId: {
          teacherId: teacher.id,
          classroomId: classroom.id,
          subjectId: subject.id,
          academicYearId: activeYear.id
        }
      },
      update: {},
      create: {
        institutionId: req.institutionId!,
        teacherId: teacher.id,
        classroomId: classroom.id,
        subjectId: subject.id,
        academicYearId: activeYear.id
      },
      include: { teacher: true, classroom: true, subject: true, academicYear: true }
    })
    res.status(201).json({ assignment })
  })
)

academicsRoutes.delete(
  '/assignments/:id',
  requireRoles(UserRole.CENTRAL_ADMIN, UserRole.DIRECTOR, UserRole.ADMINISTRATION),
  validate(z.object({ params: z.object({ id: z.string() }) })),
  asyncHandler(async (req, res) => {
    const assignment = await prisma.teacherAssignment.findFirst({
      where: { id: req.params.id, institutionId: req.institutionId! }
    })
    if (!assignment) throw notFound('Affectation introuvable')
    await prisma.teacherAssignment.delete({ where: { id: assignment.id } })
    res.json({ ok: true })
  })
)
