import { Router } from 'express'
import { z } from 'zod'
import { HomeworkStatus, UserRole } from '@prisma/client'
import { prisma } from '../../config/prisma'
import { asyncHandler } from '../../lib/async'
import { badRequest, forbidden, notFound } from '../../lib/errors'
import { authenticate } from '../../middlewares/auth'
import { requireRoles, requireTenantUser } from '../../middlewares/rbac'
import { validate } from '../../middlewares/validate'

export const homeworksRoutes = Router()
homeworksRoutes.use(authenticate, requireTenantUser)

const managementRoles = [UserRole.DIRECTOR, UserRole.ADMINISTRATION, UserRole.SECRETARIAT] as const
const allowedRoles = [UserRole.TEACHER, ...managementRoles] as const

const homeworkInclude = {
  teacher: true,
  classroom: { include: { gradeLevel: true } },
  subject: true,
  corrections: {
    include: {
      student: { include: { classroom: true } },
      grade: true
    },
    orderBy: { student: { lastName: 'asc' as const } }
  }
}

async function currentTeacher(institutionId: string, userId: string) {
  return prisma.teacher.findFirst({ where: { institutionId, userId } })
}

async function assertTeacherAssignment(institutionId: string, teacherId: string, classroomId: string, subjectId: string) {
  const assignment = await prisma.teacherAssignment.findFirst({
    where: { institutionId, teacherId, classroomId, subjectId }
  })
  if (!assignment) throw forbidden('Vous pouvez créer/corriger uniquement les devoirs de vos classes et matières assignées')
}

async function findReadableHomework(institutionId: string, user: Express.AuthUser, id: string) {
  const teacher = user.role === UserRole.TEACHER ? await currentTeacher(institutionId, user.id) : null
  const homework = await prisma.homework.findFirst({
    where: {
      id,
      institutionId,
      teacherId: teacher ? teacher.id : undefined
    },
    include: homeworkInclude
  })
  if (!homework) throw notFound('Devoir introuvable')
  return { homework, teacher }
}

async function correctionPeriod(institutionId: string, periodId?: string) {
  if (periodId) {
    const period = await prisma.gradePeriod.findFirst({ where: { id: periodId, institutionId } })
    if (!period) throw notFound('Période de notes introuvable')
    return period
  }

  const activeYear = await prisma.academicYear.findFirst({ where: { institutionId, isActive: true } })
  if (!activeYear) throw notFound('Année scolaire active introuvable')
  return prisma.gradePeriod.upsert({
    where: {
      institutionId_academicYearId_name: {
        institutionId,
        academicYearId: activeYear.id,
        name: 'Devoirs & examens'
      }
    },
    update: {},
    create: {
      institutionId,
      academicYearId: activeYear.id,
      name: 'Devoirs & examens',
      startsAt: activeYear.startsAt,
      endsAt: activeYear.endsAt
    }
  })
}

function escapeCsv(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

homeworksRoutes.get(
  '/',
  requireRoles(...allowedRoles),
  asyncHandler(async (req, res) => {
    const teacher = req.user!.role === UserRole.TEACHER ? await currentTeacher(req.institutionId!, req.user!.id) : null
    const homeworks = await prisma.homework.findMany({
      where: {
        institutionId: req.institutionId!,
        teacherId: teacher ? teacher.id : undefined,
        classroomId: typeof req.query.classroomId === 'string' ? req.query.classroomId : undefined,
        subjectId: typeof req.query.subjectId === 'string' ? req.query.subjectId : undefined,
        status: typeof req.query.status === 'string' ? (req.query.status as HomeworkStatus) : undefined
      },
      include: homeworkInclude,
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }]
    })
    res.json({ homeworks })
  })
)

homeworksRoutes.post(
  '/',
  requireRoles(UserRole.TEACHER),
  validate(
    z.object({
      body: z.object({
        classroomId: z.string(),
        subjectId: z.string(),
        kind: z.enum(['DEVOIR', 'EXAMEN', 'INTERROGATION', 'PROJET']).default('DEVOIR'),
        title: z.string().min(2),
        description: z.string().optional(),
        dueDate: z.coerce.date(),
        maxScore: z.number().positive().default(20)
      })
    })
  ),
  asyncHandler(async (req, res) => {
    const teacher = await currentTeacher(req.institutionId!, req.user!.id)
    if (!teacher) throw forbidden('Profil professeur introuvable')
    await assertTeacherAssignment(req.institutionId!, teacher.id, req.body.classroomId, req.body.subjectId)

    const students = await prisma.student.findMany({
      where: { institutionId: req.institutionId!, classroomId: req.body.classroomId, status: 'ACTIVE' },
      select: { id: true }
    })

    const homework = await prisma.homework.create({
      data: {
        institutionId: req.institutionId!,
        teacherId: teacher.id,
        classroomId: req.body.classroomId,
        subjectId: req.body.subjectId,
        kind: req.body.kind,
        title: req.body.title,
        description: req.body.description?.trim() || null,
        dueDate: req.body.dueDate,
        maxScore: req.body.maxScore,
        corrections: { create: students.map((student) => ({ studentId: student.id })) }
      },
      include: homeworkInclude
    })

    res.status(201).json({ homework })
  })
)

homeworksRoutes.patch(
  '/:id',
  requireRoles(...allowedRoles),
  validate(
    z.object({
      body: z.object({
        title: z.string().min(2).optional(),
        kind: z.enum(['DEVOIR', 'EXAMEN', 'INTERROGATION', 'PROJET']).optional(),
        description: z.string().optional().nullable(),
        dueDate: z.coerce.date().optional(),
        maxScore: z.number().positive().optional(),
        status: z.nativeEnum(HomeworkStatus).optional()
      })
    })
  ),
  asyncHandler(async (req, res) => {
    const { homework, teacher } = await findReadableHomework(req.institutionId!, req.user!, req.params.id)
    if (teacher) await assertTeacherAssignment(req.institutionId!, teacher.id, homework.classroomId, homework.subjectId)
    const nextStatus = req.body.status ?? (req.body.dueDate ? HomeworkStatus.POSTPONED : undefined)

    const updated = await prisma.homework.update({
      where: { id: homework.id },
      data: {
        title: req.body.title,
        kind: req.body.kind,
        description: req.body.description === undefined ? undefined : req.body.description?.trim() || null,
        dueDate: req.body.dueDate,
        maxScore: req.body.maxScore,
        status: nextStatus
      },
      include: homeworkInclude
    })
    res.json({ homework: updated })
  })
)

homeworksRoutes.put(
  '/:id/corrections',
  requireRoles(UserRole.TEACHER),
  validate(
    z.object({
      body: z.object({
        periodId: z.string().optional(),
        corrections: z.array(
          z.object({
            studentId: z.string(),
            score: z.number().min(0).nullable().optional(),
            appreciation: z.string().optional(),
            comment: z.string().optional()
          })
        )
      })
    })
  ),
  asyncHandler(async (req, res) => {
    const { homework, teacher } = await findReadableHomework(req.institutionId!, req.user!, req.params.id)
    if (!teacher) throw forbidden('Profil professeur introuvable')
    await assertTeacherAssignment(req.institutionId!, teacher.id, homework.classroomId, homework.subjectId)

    const period = await correctionPeriod(req.institutionId!, req.body.periodId)
    const students = await prisma.student.findMany({
      where: {
        institutionId: req.institutionId!,
        classroomId: homework.classroomId,
        id: { in: req.body.corrections.map((correction: { studentId: string }) => correction.studentId) }
      },
      select: { id: true }
    })
    const allowedStudentIds = new Set(students.map((student) => student.id))
    if (allowedStudentIds.size !== req.body.corrections.length) {
      throw forbidden('Une ou plusieurs notes concernent des élèves hors de cette classe')
    }

    await prisma.$transaction(async (tx) => {
      for (const correctionInput of req.body.corrections) {
        if (correctionInput.score !== null && correctionInput.score !== undefined && correctionInput.score > homework.maxScore) {
          throw badRequest(`La note ne peut pas dépasser ${homework.maxScore}`)
        }

        const correction = await tx.homeworkCorrection.upsert({
          where: {
            homeworkId_studentId: {
              homeworkId: homework.id,
              studentId: correctionInput.studentId
            }
          },
          update: {
            score: correctionInput.score ?? null,
            appreciation: correctionInput.appreciation?.trim() || null,
            comment: correctionInput.comment?.trim() || null,
            correctedAt: correctionInput.score === null || correctionInput.score === undefined ? null : new Date()
          },
          create: {
            homeworkId: homework.id,
            studentId: correctionInput.studentId,
            score: correctionInput.score ?? null,
            appreciation: correctionInput.appreciation?.trim() || null,
            comment: correctionInput.comment?.trim() || null,
            correctedAt: correctionInput.score === null || correctionInput.score === undefined ? null : new Date()
          }
        })

        if (correctionInput.score !== null && correctionInput.score !== undefined) {
          const gradeData = {
            institutionId: req.institutionId!,
            teacherId: teacher.id,
            studentId: correctionInput.studentId,
            subjectId: homework.subjectId,
            periodId: period.id,
            score: correctionInput.score,
            maxScore: homework.maxScore,
            coefficient: homework.subject.coefficient || 1,
            appreciation: correctionInput.appreciation?.trim() || correctionInput.comment?.trim() || `Devoir : ${homework.title}`
          }
          if (correction.gradeId) {
            await tx.grade.update({ where: { id: correction.gradeId }, data: gradeData })
          } else {
            const grade = await tx.grade.create({ data: gradeData })
            await tx.homeworkCorrection.update({ where: { id: correction.id }, data: { gradeId: grade.id } })
          }
        }
      }

      const correctedCount = await tx.homeworkCorrection.count({
        where: { homeworkId: homework.id, score: { not: null } }
      })
      const totalCount = await tx.homeworkCorrection.count({ where: { homeworkId: homework.id } })
      await tx.homework.update({
        where: { id: homework.id },
        data: { status: correctedCount === totalCount && totalCount > 0 ? HomeworkStatus.GRADED : HomeworkStatus.CORRECTING }
      })
    })

    const updated = await prisma.homework.findUnique({ where: { id: homework.id }, include: homeworkInclude })
    res.json({ homework: updated })
  })
)

homeworksRoutes.get(
  '/:id/export.csv',
  requireRoles(...allowedRoles),
  asyncHandler(async (req, res) => {
    const { homework } = await findReadableHomework(req.institutionId!, req.user!, req.params.id)
    const lines = [
      ['Nom', 'Prénom', 'Matricule', 'Classe', `Note / ${homework.maxScore}`, 'Appréciation', 'Commentaire', 'Corrigé le'].map(escapeCsv).join(',')
    ]
    for (const correction of homework.corrections) {
      lines.push([
        correction.student.lastName,
        correction.student.firstName,
        correction.student.matricule,
        correction.student.classroom?.name ?? homework.classroom.name,
        correction.score ?? '',
        correction.appreciation ?? '',
        correction.comment ?? '',
        correction.correctedAt?.toISOString() ?? ''
      ].map(escapeCsv).join(','))
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="notes-${homework.id}.csv"`)
    res.send(`\uFEFF${lines.join('\n')}`)
  })
)
