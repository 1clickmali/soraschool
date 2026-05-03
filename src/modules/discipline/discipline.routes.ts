import { Router } from 'express'
import { z } from 'zod'
import { DisciplineKind, UserRole } from '@prisma/client'
import { prisma } from '../../config/prisma'
import { asyncHandler } from '../../lib/async'
import { forbidden, notFound } from '../../lib/errors'
import { authenticate } from '../../middlewares/auth'
import { requireRoles, requireTenantUser } from '../../middlewares/rbac'
import { validate } from '../../middlewares/validate'

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

    const record = await prisma.disciplineRecord.create({
      data: {
        institutionId: req.institutionId!,
        teacherId,
        studentId: req.body.studentId,
        kind: req.body.kind ?? mapDisciplineKind(req.body.type),
        title: req.body.title ?? req.body.type ?? 'Signalement',
        description: req.body.description ?? req.body.sanctions,
        points: req.body.points,
        parentNotified: req.body.parentNotified
      }
    })
    res.status(201).json({ record })
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
