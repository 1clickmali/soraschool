import { Router } from 'express'
import { z } from 'zod'
import { ContractType, Prisma, UserRole } from '@prisma/client'
import { prisma } from '../../config/prisma'
import { asyncHandler } from '../../lib/async'
import { getScopedEstablishmentId, resolveWritableEstablishmentId } from '../../lib/access-scope'
import { notFound } from '../../lib/errors'
import { generateMatricule, normalizePhone } from '../../lib/security'
import { assertTeacherCapacity } from '../../lib/plan-limits'
import { authenticate } from '../../middlewares/auth'
import { requireRoles, requireTenantUser } from '../../middlewares/rbac'
import { validate } from '../../middlewares/validate'
import { renderTeacherCardPdf, renderTeacherContractPdf, renderTeacherProfilePdf } from '../pdf/pdf.service'
import { ensureStaffForTeacher } from '../staff/staff.service'
import { emailWelcome } from '../../lib/email'

export const teachersRoutes = Router()
teachersRoutes.use(authenticate, requireTenantUser)

const managementRoles = [UserRole.CENTRAL_ADMIN, UserRole.DIRECTOR, UserRole.ADMINISTRATION] as const
const insensitive = Prisma.QueryMode.insensitive

function clean(value: unknown) {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length ? trimmed : undefined
}

teachersRoutes.get(
  '/',
  asyncHandler(async (req, res) => {
    const search = clean(req.query.search)
    const classroomId = clean(req.query.classroomId)
    const status = clean(req.query.status)
    const where: Prisma.TeacherWhereInput =
      req.user!.role === UserRole.TEACHER
        ? { institutionId: req.institutionId!, userId: req.user!.id }
        : {
            institutionId: req.institutionId!,
            establishmentId: getScopedEstablishmentId(req),
            status: status as never,
            assignments: classroomId ? { some: { classroomId } } : undefined,
            OR: search
              ? [
                  { firstName: { contains: search, mode: insensitive } },
                  { lastName: { contains: search, mode: insensitive } },
                  { matricule: { contains: search, mode: insensitive } },
                  { phone: { contains: search, mode: insensitive } },
                  { email: { contains: search, mode: insensitive } },
                  { specialization: { contains: search, mode: insensitive } }
                ]
              : undefined
          }
    const teachers = await prisma.teacher.findMany({
      where,
      include: { assignments: { include: { classroom: true, subject: true } } },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
    })
    res.json({ teachers })
  })
)

teachersRoutes.post(
  '/',
  requireRoles(...managementRoles),
  validate(
    z.object({
      body: z.object({
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        establishmentId: z.string().optional(),
        phone: z.string().min(6),
        email: z.string().email().optional(),
        address: z.string().optional(),
        photoUrl: z.string().optional(),
        contractType: z.union([z.nativeEnum(ContractType), z.enum(['VACATION'])]).default(ContractType.CDI),
        baseSalary: z.number().int().nonnegative().default(0),
        salary: z.number().int().nonnegative().optional(),
        hireDate: z.coerce.date().optional(),
        specialization: z.string().optional(),
        speciality: z.string().optional(),
        subjectIds: z.array(z.string()).optional(),
        classIds: z.array(z.string()).optional(),
        idDocumentUrl: z.string().optional(),
        cvUrl: z.string().optional(),
        contractUrl: z.string().optional(),
        documentsChecklist: z.record(z.string()).optional()
      })
    })
  ),
  asyncHandler(async (req, res) => {
    await assertTeacherCapacity(req.institutionId!)
    const phone = normalizePhone(req.body.phone)
    const institution = await prisma.institution.findUnique({ where: { id: req.institutionId! } })
    const prefix = `${institution?.slug.toUpperCase() ?? 'SCHOOL'}-PR`
    const lastTeacher = await prisma.teacher.findFirst({
      where: { institutionId: req.institutionId!, matricule: { startsWith: prefix } },
      orderBy: { matricule: 'desc' },
      select: { matricule: true }
    })
    const lastSeq = lastTeacher ? (parseInt(lastTeacher.matricule.slice(prefix.length + 1), 10) || 0) : 0
    const count = lastSeq
    const contractType = req.body.contractType === 'VACATION' ? ContractType.VACATAIRE : req.body.contractType
    const specialization = clean(req.body.specialization ?? req.body.speciality)
    const establishmentId = resolveWritableEstablishmentId(req, req.body.establishmentId)

    const teacher = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          institutionId: req.institutionId!,
          establishmentId,
          role: UserRole.TEACHER,
          firstName: req.body.firstName,
          lastName: req.body.lastName,
          phone,
          email: req.body.email,
          avatarUrl: clean(req.body.photoUrl)
        }
      })
      await tx.allowedPhone.upsert({
        where: { institutionId_phone: { institutionId: req.institutionId!, phone } },
        update: { role: UserRole.TEACHER, firstName: req.body.firstName, lastName: req.body.lastName, email: req.body.email },
        create: {
          institutionId: req.institutionId!,
          phone,
          role: UserRole.TEACHER,
          firstName: req.body.firstName,
          lastName: req.body.lastName,
          email: req.body.email,
          createdById: req.user!.id
        }
      })
      const created = await tx.teacher.create({
        data: {
          institutionId: req.institutionId!,
          establishmentId,
          userId: user.id,
          matricule: generateMatricule(prefix, count),
          firstName: req.body.firstName,
          lastName: req.body.lastName,
          phone,
          email: clean(req.body.email),
          address: clean(req.body.address),
          photoUrl: clean(req.body.photoUrl),
          contractType,
          baseSalary: req.body.salary ?? req.body.baseSalary ?? 0,
          hireDate: req.body.hireDate,
          specialization,
          idDocumentUrl: clean(req.body.idDocumentUrl),
          cvUrl: clean(req.body.cvUrl),
          contractUrl: clean(req.body.contractUrl),
          metadata: {
            documentsChecklist: req.body.documentsChecklist ?? {}
          }
        }
      })
      const activeYear = await tx.academicYear.findFirst({ where: { institutionId: req.institutionId!, isActive: true } })
      const subjectIds = Array.isArray(req.body.subjectIds) ? req.body.subjectIds : []
      const classIds = Array.isArray(req.body.classIds) ? req.body.classIds : []
      if (activeYear && subjectIds.length && classIds.length) {
        for (const classroomId of classIds) {
          for (const subjectId of subjectIds) {
            await tx.teacherAssignment.upsert({
              where: {
                teacherId_classroomId_subjectId_academicYearId: {
                  teacherId: created.id,
                  classroomId,
                  subjectId,
                  academicYearId: activeYear.id
                }
              },
              update: {},
              create: {
                institutionId: req.institutionId!,
                teacherId: created.id,
                classroomId,
                subjectId,
                academicYearId: activeYear.id
              }
            })
          }
        }
      }
      return tx.teacher.findUnique({
        where: { id: created.id },
        include: { assignments: { include: { classroom: true, subject: true } } }
      })
    })
    if (teacher?.id) await ensureStaffForTeacher(teacher.id, req.user!.id)

    if (teacher && req.body.email) {
      const institutionForEmail = await prisma.institution.findUnique({ where: { id: req.institutionId! }, select: { name: true } })
      emailWelcome({
        to: req.body.email,
        firstName: req.body.firstName,
        institutionName: institutionForEmail?.name ?? 'votre établissement',
        appName: process.env.APP_NAME ?? 'SoraSchool',
        loginUrl: process.env.FRONTEND_URL ?? 'https://app.soraschool.ci'
      }).catch(() => {})
    }

    res.status(201).json({
      teacher,
      pdfs: {
        teacherCard: `/api/teachers/${teacher!.id}/card`,
        teacherProfile: `/api/teachers/${teacher!.id}/profile-pdf`,
        teacherContract: `/api/teachers/${teacher!.id}/contract-pdf`
      }
    })
  })
)

teachersRoutes.get(
  '/me/salary',
  requireRoles(UserRole.TEACHER),
  asyncHandler(async (req, res) => {
    const teacher = await prisma.teacher.findFirst({ where: { userId: req.user!.id, institutionId: req.institutionId! } })
    const salaries = teacher
      ? await prisma.teacherSalary.findMany({ where: { teacherId: teacher.id }, orderBy: [{ year: 'desc' }, { month: 'desc' }] })
      : []
    const penalties = teacher
      ? await prisma.teacherPenalty.findMany({ where: { teacherId: teacher.id }, orderBy: { date: 'desc' } })
      : []
    res.json({ salaries, penalties })
  })
)

teachersRoutes.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const teacher = await prisma.teacher.findFirst({
      where: { id: req.params.id, institutionId: req.institutionId!, establishmentId: getScopedEstablishmentId(req) },
      include: { assignments: { include: { classroom: true, subject: true, academicYear: true } }, diplomas: true, experiences: true }
    })
    res.json({ teacher })
  })
)

teachersRoutes.patch(
  '/:id',
  requireRoles(...managementRoles),
  asyncHandler(async (req, res) => {
    const existing = await prisma.teacher.findFirst({
      where: { id: req.params.id, institutionId: req.institutionId!, establishmentId: getScopedEstablishmentId(req) }
    })
    if (!existing) throw notFound('Enseignant introuvable')
    const teacher = await prisma.teacher.update({ where: { id: existing.id }, data: req.body })
    res.json({ teacher })
  })
)

teachersRoutes.get(
  '/:id/card',
  requireRoles(UserRole.SUPER_ADMIN, ...managementRoles),
  asyncHandler(async (req, res) => {
    const buffer = await renderTeacherCardPdf(req.institutionId!, req.params.id, String(req.query.lang ?? 'FR'))
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="carte-professeur-${req.params.id}.pdf"`)
    res.send(buffer)
  })
)

teachersRoutes.get(
  '/:id/profile-pdf',
  asyncHandler(async (req, res) => {
    const buffer = await renderTeacherProfilePdf(req.institutionId!, req.params.id, String(req.query.lang ?? 'FR'))
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="fiche-professeur-${req.params.id}.pdf"`)
    res.send(buffer)
  })
)

teachersRoutes.get(
  '/:id/contract-pdf',
  asyncHandler(async (req, res) => {
    const buffer = await renderTeacherContractPdf(req.institutionId!, req.params.id, String(req.query.lang ?? 'FR'))
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="contrat-professeur-${req.params.id}.pdf"`)
    res.send(buffer)
  })
)

teachersRoutes.delete(
  '/:id',
  requireRoles(...managementRoles),
  asyncHandler(async (req, res) => {
    const teacher = await prisma.teacher.findFirst({
      where: { id: req.params.id, institutionId: req.institutionId! }
    })
    if (!teacher) throw notFound('Enseignant introuvable')
    await prisma.teacher.update({
      where: { id: teacher.id },
      data: { status: 'TERMINATED' as const }
    })
    res.json({ ok: true })
  })
)

// ─── Teacher Diplomas ─────────────────────────────────────────────────────────

teachersRoutes.get(
  '/:id/diplomas',
  asyncHandler(async (req, res) => {
    const teacher = await prisma.teacher.findFirst({ where: { id: req.params.id, institutionId: req.institutionId! } })
    if (!teacher) throw notFound('Enseignant introuvable')
    const diplomas = await prisma.teacherDiploma.findMany({ where: { teacherId: teacher.id }, orderBy: { year: 'desc' } })
    res.json({ diplomas })
  })
)

teachersRoutes.post(
  '/:id/diplomas',
  requireRoles(...managementRoles),
  validate(
    z.object({
      body: z.object({
        title: z.string().min(1),
        institution: z.string().min(1),
        year: z.number().int().min(1950).max(new Date().getFullYear() + 1),
        city: z.string().optional(),
        country: z.string().optional(),
        mention: z.string().optional(),
        documentUrl: z.string().optional()
      })
    })
  ),
  asyncHandler(async (req, res) => {
    const teacher = await prisma.teacher.findFirst({ where: { id: req.params.id, institutionId: req.institutionId! } })
    if (!teacher) throw notFound('Enseignant introuvable')
    const diploma = await prisma.teacherDiploma.create({
      data: {
        teacherId: teacher.id,
        title: req.body.title,
        institution: req.body.institution,
        year: req.body.year,
        city: req.body.city,
        country: req.body.country,
        mention: req.body.mention,
        documentUrl: req.body.documentUrl
      }
    })
    res.status(201).json({ diploma })
  })
)

teachersRoutes.patch(
  '/:id/diplomas/:diplomaId',
  requireRoles(...managementRoles),
  asyncHandler(async (req, res) => {
    const teacher = await prisma.teacher.findFirst({ where: { id: req.params.id, institutionId: req.institutionId! } })
    if (!teacher) throw notFound('Enseignant introuvable')
    const diploma = await prisma.teacherDiploma.findFirst({ where: { id: req.params.diplomaId, teacherId: teacher.id } })
    if (!diploma) throw notFound('Diplôme introuvable')
    const updated = await prisma.teacherDiploma.update({ where: { id: diploma.id }, data: req.body })
    res.json({ diploma: updated })
  })
)

teachersRoutes.delete(
  '/:id/diplomas/:diplomaId',
  requireRoles(...managementRoles),
  asyncHandler(async (req, res) => {
    const teacher = await prisma.teacher.findFirst({ where: { id: req.params.id, institutionId: req.institutionId! } })
    if (!teacher) throw notFound('Enseignant introuvable')
    const diploma = await prisma.teacherDiploma.findFirst({ where: { id: req.params.diplomaId, teacherId: teacher.id } })
    if (!diploma) throw notFound('Diplôme introuvable')
    await prisma.teacherDiploma.delete({ where: { id: diploma.id } })
    res.json({ ok: true })
  })
)

// ─── Teacher Experiences ──────────────────────────────────────────────────────

teachersRoutes.get(
  '/:id/experiences',
  asyncHandler(async (req, res) => {
    const teacher = await prisma.teacher.findFirst({ where: { id: req.params.id, institutionId: req.institutionId! } })
    if (!teacher) throw notFound('Enseignant introuvable')
    const experiences = await prisma.teacherExperience.findMany({ where: { teacherId: teacher.id }, orderBy: { startDate: 'desc' } })
    res.json({ experiences })
  })
)

teachersRoutes.post(
  '/:id/experiences',
  requireRoles(...managementRoles),
  validate(
    z.object({
      body: z.object({
        institution: z.string().min(1),
        position: z.string().min(1),
        startDate: z.coerce.date(),
        endDate: z.coerce.date().optional(),
        subjects: z.string().optional(),
        reasonLeft: z.string().optional(),
        refereeName: z.string().optional(),
        refereePhone: z.string().optional()
      })
    })
  ),
  asyncHandler(async (req, res) => {
    const teacher = await prisma.teacher.findFirst({ where: { id: req.params.id, institutionId: req.institutionId! } })
    if (!teacher) throw notFound('Enseignant introuvable')
    const experience = await prisma.teacherExperience.create({
      data: {
        teacherId: teacher.id,
        institution: req.body.institution,
        position: req.body.position,
        startDate: req.body.startDate,
        endDate: req.body.endDate,
        subjects: req.body.subjects,
        reasonLeft: req.body.reasonLeft,
        refereeName: req.body.refereeName,
        refereePhone: req.body.refereePhone
      }
    })
    res.status(201).json({ experience })
  })
)

teachersRoutes.patch(
  '/:id/experiences/:expId',
  requireRoles(...managementRoles),
  asyncHandler(async (req, res) => {
    const teacher = await prisma.teacher.findFirst({ where: { id: req.params.id, institutionId: req.institutionId! } })
    if (!teacher) throw notFound('Enseignant introuvable')
    const experience = await prisma.teacherExperience.findFirst({ where: { id: req.params.expId, teacherId: teacher.id } })
    if (!experience) throw notFound('Expérience introuvable')
    const updated = await prisma.teacherExperience.update({ where: { id: experience.id }, data: req.body })
    res.json({ experience: updated })
  })
)

teachersRoutes.delete(
  '/:id/experiences/:expId',
  requireRoles(...managementRoles),
  asyncHandler(async (req, res) => {
    const teacher = await prisma.teacher.findFirst({ where: { id: req.params.id, institutionId: req.institutionId! } })
    if (!teacher) throw notFound('Enseignant introuvable')
    const experience = await prisma.teacherExperience.findFirst({ where: { id: req.params.expId, teacherId: teacher.id } })
    if (!experience) throw notFound('Expérience introuvable')
    await prisma.teacherExperience.delete({ where: { id: experience.id } })
    res.json({ ok: true })
  })
)

// ─── Teacher Penalties ────────────────────────────────────────────────────────

teachersRoutes.get(
  '/:id/penalties',
  requireRoles(UserRole.SUPER_ADMIN, ...managementRoles),
  asyncHandler(async (req, res) => {
    const teacher = await prisma.teacher.findFirst({ where: { id: req.params.id, institutionId: req.institutionId! } })
    if (!teacher) throw notFound('Enseignant introuvable')
    const penalties = await prisma.teacherPenalty.findMany({
      where: { teacherId: teacher.id, institutionId: req.institutionId! },
      orderBy: { date: 'desc' }
    })
    res.json({ penalties })
  })
)

teachersRoutes.post(
  '/:id/penalties',
  requireRoles(...managementRoles),
  validate(
    z.object({
      body: z.object({
        amount: z.number().int().positive(),
        reason: z.string().min(2),
        date: z.coerce.date().optional()
      })
    })
  ),
  asyncHandler(async (req, res) => {
    const teacher = await prisma.teacher.findFirst({ where: { id: req.params.id, institutionId: req.institutionId! } })
    if (!teacher) throw notFound('Enseignant introuvable')
    const penalty = await prisma.teacherPenalty.create({
      data: {
        institutionId: req.institutionId!,
        teacherId: teacher.id,
        amount: req.body.amount,
        reason: req.body.reason,
        date: req.body.date ?? new Date()
      }
    })
    res.status(201).json({ penalty })
  })
)

teachersRoutes.patch(
  '/:id/penalties/:penaltyId',
  requireRoles(...managementRoles),
  asyncHandler(async (req, res) => {
    const teacher = await prisma.teacher.findFirst({ where: { id: req.params.id, institutionId: req.institutionId! } })
    if (!teacher) throw notFound('Enseignant introuvable')
    const penalty = await prisma.teacherPenalty.findFirst({ where: { id: req.params.penaltyId, teacherId: teacher.id } })
    if (!penalty) throw notFound('Pénalité introuvable')
    const updated = await prisma.teacherPenalty.update({
      where: { id: penalty.id },
      data: {
        amount: req.body.amount ?? penalty.amount,
        reason: req.body.reason ?? penalty.reason,
        contestedAt: req.body.contested ? new Date() : penalty.contestedAt,
        resolvedAt: req.body.resolved ? new Date() : penalty.resolvedAt
      }
    })
    res.json({ penalty: updated })
  })
)

teachersRoutes.delete(
  '/:id/penalties/:penaltyId',
  requireRoles(...managementRoles),
  asyncHandler(async (req, res) => {
    const teacher = await prisma.teacher.findFirst({ where: { id: req.params.id, institutionId: req.institutionId! } })
    if (!teacher) throw notFound('Enseignant introuvable')
    const penalty = await prisma.teacherPenalty.findFirst({ where: { id: req.params.penaltyId, teacherId: teacher.id } })
    if (!penalty) throw notFound('Pénalité introuvable')
    await prisma.teacherPenalty.delete({ where: { id: penalty.id } })
    res.json({ ok: true })
  })
)
