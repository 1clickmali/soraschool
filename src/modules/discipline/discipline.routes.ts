import { Router } from 'express'
import { z } from 'zod'
import { DisciplineKind, UserRole } from '@prisma/client'
import { prisma } from '../../config/prisma'
import { asyncHandler } from '../../lib/async'
import { forbidden, notFound } from '../../lib/errors'
import { authenticate } from '../../middlewares/auth'
import { requireRoles, requireTenantUser } from '../../middlewares/rbac'
import { validate } from '../../middlewares/validate'
import { notifyDisciplineAlert } from '../../lib/notifications'
import { getPlatformBranding } from '../../lib/platform-branding'

export const disciplineRoutes = Router()
disciplineRoutes.use(authenticate, requireTenantUser)

disciplineRoutes.get(
  '/',
  asyncHandler(async (req, res) => {
    const records = await prisma.disciplineRecord.findMany({
      where: {
        institutionId: req.institutionId!,
        kind: req.query.kind ? String(req.query.kind) as never : undefined,
        student: req.query.classroomId ? { classroomId: String(req.query.classroomId) } : undefined,
        OR: req.query.search
          ? [
              { title: { contains: String(req.query.search), mode: 'insensitive' } },
              { description: { contains: String(req.query.search), mode: 'insensitive' } },
              { student: { firstName: { contains: String(req.query.search), mode: 'insensitive' } } },
              { student: { lastName: { contains: String(req.query.search), mode: 'insensitive' } } },
              { student: { matricule: { contains: String(req.query.search), mode: 'insensitive' } } }
            ]
          : undefined
      },
      include: { student: { include: { classroom: true } }, teacher: true },
      orderBy: { createdAt: 'desc' }
    })
    res.json({ records })
  })
)

disciplineRoutes.post(
  '/',
  requireRoles(UserRole.TEACHER, UserRole.DIRECTOR, UserRole.ADMINISTRATION),
  validate(
    z.object({
      body: z.object({
        studentId: z.string(),
        kind: z.nativeEnum(DisciplineKind).optional(),
        type: z.string().optional(),
        title: z.string().min(2).optional(),
        description: z.string().optional(),
        sanctions: z.string().optional(),
        points: z.number().int().default(0),
        parentNotified: z.boolean().default(false)
      })
    })
  ),
  asyncHandler(async (req, res) => {
    let teacherId: string | undefined
    if (req.user!.role === UserRole.TEACHER) {
      const teacher = await prisma.teacher.findFirst({ where: { userId: req.user!.id, institutionId: req.institutionId! } })
      const student = await prisma.student.findFirst({ where: { id: req.body.studentId, institutionId: req.institutionId! } })
      if (!teacher || !student?.classroomId) throw notFound('Profil professeur ou élève introuvable')
      const assignment = await prisma.teacherAssignment.findFirst({
        where: { institutionId: req.institutionId!, teacherId: teacher.id, classroomId: student.classroomId }
      })
      if (!assignment) throw forbidden('Vous pouvez sanctionner uniquement les élèves de vos classes')
      teacherId = teacher.id
    }

    const institutionId = req.institutionId!
    const points = req.body.points ?? 0

    const [record, student] = await prisma.$transaction(async (tx) => {
      const rec = await tx.disciplineRecord.create({
        data: {
          institutionId,
          teacherId,
          studentId: req.body.studentId,
          kind: req.body.kind ?? mapDisciplineKind(req.body.type),
          title: req.body.title ?? req.body.type ?? 'Signalement',
          description: req.body.description ?? req.body.sanctions,
          points,
          parentNotified: req.body.parentNotified
        }
      })

      if (points !== 0) {
        await tx.disciplineScore.upsert({
          where: { studentId: req.body.studentId },
          create: { institutionId, studentId: req.body.studentId, score: Math.max(0, Math.min(100, 100 + points)) },
          update: { score: { increment: points } }
        })
        await tx.disciplineScore.updateMany({
          where: { institutionId, studentId: req.body.studentId, score: { gt: 100 } },
          data: { score: 100 }
        })
        await tx.disciplineScore.updateMany({
          where: { institutionId, studentId: req.body.studentId, score: { lt: 0 } },
          data: { score: 0 }
        })
      }

      const stu = await tx.student.findUnique({ where: { id: req.body.studentId } })
      return [rec, stu]
    })

    if (points < 0 && student) {
      const scoreRow = await prisma.disciplineScore.findUnique({ where: { studentId: student.id } })
      const score = scoreRow?.score ?? 100
      const alertThresholds = [50, 30, 10]
      const wasAbove = score - points
      const triggered = alertThresholds.find((t) => wasAbove > t && score <= t)
      if (triggered) {
        const branding = await getPlatformBranding()
        const parentLinks = await prisma.studentParent.findMany({
          where: { studentId: student.id },
          include: { parent: { select: { phone: true, userId: true } } }
        })
        for (const link of parentLinks) {
          await notifyDisciplineAlert({
            institutionId: institutionId,
            studentName: `${student.firstName} ${student.lastName}`,
            score,
            parentUserId: link.parent.userId ?? undefined,
            parentPhone: link.parent.phone,
            appName: branding.appName
          })
        }
      }
    }

    res.status(201).json({ record })
  })
)

disciplineRoutes.get(
  '/scores',
  requireRoles(UserRole.DIRECTOR, UserRole.ADMINISTRATION),
  asyncHandler(async (req, res) => {
    const scores = await prisma.disciplineScore.findMany({
      where: { institutionId: req.institutionId! },
      include: {
        student: {
          select: {
            id: true, firstName: true, lastName: true, matricule: true,
            classroom: { select: { name: true } }
          }
        }
      },
      orderBy: { score: 'asc' }
    })
    res.json({ scores })
  })
)

// ─── Discipline Rules ─────────────────────────────────────────────────────────

disciplineRoutes.get(
  '/rules',
  asyncHandler(async (req, res) => {
    const rules = await prisma.disciplineRule.findMany({
      where: { institutionId: req.institutionId!, isActive: req.query.active === 'false' ? undefined : true },
      orderBy: [{ kind: 'asc' }, { points: 'asc' }]
    })
    res.json({ rules })
  })
)

disciplineRoutes.post(
  '/rules',
  requireRoles(UserRole.DIRECTOR, UserRole.ADMINISTRATION),
  validate(
    z.object({
      body: z.object({
        kind: z.string().min(1),
        title: z.string().min(2),
        points: z.number().int(),
        isActive: z.boolean().default(true)
      })
    })
  ),
  asyncHandler(async (req, res) => {
    const rule = await prisma.disciplineRule.create({
      data: {
        institutionId: req.institutionId!,
        kind: req.body.kind,
        title: req.body.title,
        points: req.body.points,
        isActive: req.body.isActive
      }
    })
    res.status(201).json({ rule })
  })
)

disciplineRoutes.patch(
  '/rules/:id',
  requireRoles(UserRole.DIRECTOR, UserRole.ADMINISTRATION),
  asyncHandler(async (req, res) => {
    const rule = await prisma.disciplineRule.findFirst({ where: { id: req.params.id, institutionId: req.institutionId! } })
    if (!rule) throw notFound('Règle introuvable')
    const updated = await prisma.disciplineRule.update({
      where: { id: rule.id },
      data: {
        kind: req.body.kind ?? rule.kind,
        title: req.body.title ?? rule.title,
        points: req.body.points ?? rule.points,
        isActive: req.body.isActive ?? rule.isActive
      }
    })
    res.json({ rule: updated })
  })
)

disciplineRoutes.delete(
  '/rules/:id',
  requireRoles(UserRole.DIRECTOR, UserRole.ADMINISTRATION),
  asyncHandler(async (req, res) => {
    const rule = await prisma.disciplineRule.findFirst({ where: { id: req.params.id, institutionId: req.institutionId! } })
    if (!rule) throw notFound('Règle introuvable')
    await prisma.disciplineRule.update({ where: { id: rule.id }, data: { isActive: false } })
    res.json({ ok: true })
  })
)

// ─── Discipline Record detail ─────────────────────────────────────────────────

disciplineRoutes.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const record = await prisma.disciplineRecord.findFirst({
      where: { id: req.params.id, institutionId: req.institutionId! },
      include: { student: { include: { classroom: true } }, teacher: true }
    })
    if (!record) throw notFound('Signalement introuvable')
    res.json({ record })
  })
)

disciplineRoutes.delete(
  '/:id',
  requireRoles(UserRole.DIRECTOR, UserRole.ADMINISTRATION),
  asyncHandler(async (req, res) => {
    const record = await prisma.disciplineRecord.findFirst({ where: { id: req.params.id, institutionId: req.institutionId! } })
    if (!record) throw notFound('Signalement introuvable')
    if (record.points !== 0) {
      await prisma.disciplineScore.updateMany({
        where: { institutionId: req.institutionId!, studentId: record.studentId },
        data: { score: { decrement: record.points } }
      })
    }
    await prisma.disciplineRecord.delete({ where: { id: record.id } })
    res.json({ ok: true })
  })
)

function mapDisciplineKind(type?: string) {
  switch (type) {
    case 'GOOD_POINT':
      return DisciplineKind.GOOD_POINT
    case 'BAD_POINT':
      return DisciplineKind.BAD_POINT
    case 'WARNING':
    case 'OBSERVATION':
      return DisciplineKind.WARNING
    case 'PARENT_SUMMONS':
      return DisciplineKind.PARENT_SUMMONS
    default:
      return DisciplineKind.SANCTION
  }
}
