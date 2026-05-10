import { Router } from 'express'
import { z } from 'zod'
import { Prisma, StudentStatus, UserRole } from '@prisma/client'
import { prisma } from '../../config/prisma'
import { asyncHandler } from '../../lib/async'
import { forbidden, notFound } from '../../lib/errors'
import { parentCanAccessStudent } from '../../lib/parent-access'
import { authenticate } from '../../middlewares/auth'
import { requireRoles, requireTenantUser } from '../../middlewares/rbac'
import { validate } from '../../middlewares/validate'
import { renderReportCardPdf, renderStudentCertificatePdf } from '../pdf/pdf.service'
import { parentAppUrl, shareParentDocument } from '../../lib/parent-document-share'
import { sharedDocumentUrl } from '../../lib/shared-document-links'
import { notifyGrade } from '../../lib/notifications'
import { emailGradeAlert } from '../../lib/email'

export const gradesRoutes = Router()
gradesRoutes.use(authenticate, requireTenantUser)

const managementRoles = [UserRole.DIRECTOR, UserRole.ADMINISTRATION, UserRole.SECRETARIAT] as const
const parentShareBody = z.object({
  body: z.object({
    channel: z.enum(['WHATSAPP', 'SMS', 'IN_APP'])
  })
})

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

gradesRoutes.get(
  '/periods',
  asyncHandler(async (req, res) => {
    const periods = await prisma.gradePeriod.findMany({
      where: { institutionId: req.institutionId! },
      orderBy: { startsAt: 'asc' }
    })
    res.json({ periods })
  })
)

gradesRoutes.post(
  '/periods',
  requireRoles(...managementRoles),
  validate(
    z.object({
      body: z.object({
        academicYearId: z.string(),
        name: z.string().min(1),
        startsAt: z.coerce.date(),
        endsAt: z.coerce.date()
      })
    })
  ),
  asyncHandler(async (req, res) => {
    const period = await prisma.gradePeriod.create({
      data: { institutionId: req.institutionId!, ...req.body }
    })
    res.status(201).json({ period })
  })
)

gradesRoutes.get(
  '/report-cards/:studentId/:periodId/pdf',
  requireRoles(UserRole.DIRECTOR, UserRole.ADMINISTRATION, UserRole.SECRETARIAT, UserRole.TEACHER, UserRole.PARENT),
  asyncHandler(async (req, res) => {
    if (req.user!.role === UserRole.PARENT) {
      const allowed = await parentCanAccessStudent(req.institutionId!, req.user!.id, req.params.studentId)
      if (!allowed) throw forbidden('Bulletin non autorisé')
    }
    const buffer = await renderReportCardPdf(
      req.institutionId!,
      req.params.studentId,
      req.params.periodId,
      String(req.query.lang ?? 'FR')
    )
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="bulletin-${req.params.studentId}-${req.params.periodId}.pdf"`)
    res.send(buffer)
  })
)

gradesRoutes.post(
  '/report-cards/:studentId/:periodId/share-parent',
  requireRoles(...managementRoles, UserRole.TEACHER),
  validate(parentShareBody),
  asyncHandler(async (req, res) => {
    const [student, period] = await Promise.all([
      prisma.student.findFirst({
        where: { id: req.params.studentId, institutionId: req.institutionId! },
        include: {
          classroom: true,
          institution: { select: { slug: true, name: true } }
        }
      }),
      prisma.gradePeriod.findFirst({
        where: { id: req.params.periodId, institutionId: req.institutionId! }
      })
    ])
    if (!student) throw notFound('Élève introuvable')
    if (!period) throw notFound('Période introuvable')

    if (req.user!.role === UserRole.TEACHER) {
      const teacher = await prisma.teacher.findFirst({
        where: { userId: req.user!.id, institutionId: req.institutionId! },
        select: { id: true }
      })
      const allowed = teacher && student.classroomId
        ? await prisma.teacherAssignment.findFirst({
            where: {
              institutionId: req.institutionId!,
              teacherId: teacher.id,
              classroomId: student.classroomId
            },
            select: { id: true }
          })
        : null
      if (!allowed) throw forbidden("Vous ne pouvez envoyer que les bulletins de vos classes assignées")
    }

    const studentName = `${student.firstName} ${student.lastName}`.trim()
    const documentUrl = sharedDocumentUrl({
      type: 'REPORT_CARD',
      institutionId: req.institutionId!,
      studentId: student.id,
      periodId: period.id
    })
    const appUrl = parentAppUrl(student.institution.slug, 'bulletins')
    const message = [
      `Bonjour, ${student.institution.name} vous informe que le bulletin de ${studentName} pour ${period.name} est disponible.`,
      `PDF: ${documentUrl}`,
      `Espace parent: ${appUrl}`
    ].join(' ')

    const payload = await shareParentDocument({
      institutionId: req.institutionId!,
      actorId: req.user!.id,
      req,
      studentId: student.id,
      studentName,
      documentType: 'REPORT_CARD',
      entityId: `${student.id}:${period.id}`,
      channel: req.body.channel,
      title: `Bulletin ${period.name} — ${studentName}`,
      body: `Le bulletin de ${studentName} pour ${period.name} est disponible.`,
      message,
      documentUrl,
      appUrl,
      metadata: { periodId: period.id, periodName: period.name, classroomId: student.classroomId }
    })

    res.json(payload)
  })
)

gradesRoutes.get(
  '/certificates/:studentId/pdf',
  requireRoles(UserRole.DIRECTOR, UserRole.ADMINISTRATION, UserRole.SECRETARIAT, UserRole.PARENT),
  asyncHandler(async (req, res) => {
    if (req.user!.role === UserRole.PARENT) {
      const allowed = await parentCanAccessStudent(req.institutionId!, req.user!.id, req.params.studentId)
      if (!allowed) throw forbidden('Document non autorisé')
    }
    const kind = String(req.query.type ?? 'SCHOOL_CERTIFICATE')
    const buffer = await renderStudentCertificatePdf(req.institutionId!, req.params.studentId, kind, String(req.query.lang ?? 'FR'))
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="${kind.toLowerCase()}-${req.params.studentId}.pdf"`)
    res.send(buffer)
  })
)

gradesRoutes.post(
  '/annual-decisions',
  requireRoles(...managementRoles),
  validate(
    z.object({
      body: z.object({
        studentId: z.string(),
        decision: z.enum(['PASSED', 'REPEATED', 'GRADUATED']),
        academicYearId: z.string().optional(),
        nextClassroomId: z.string().optional(),
        comment: z.string().optional(),
        applyToStudent: z.boolean().default(false)
      })
    })
  ),
  asyncHandler(async (req, res) => {
    const student = await prisma.student.findFirst({
      where: { id: req.body.studentId, institutionId: req.institutionId! }
    })
    if (!student) throw notFound('Élève introuvable')

    const [nextClassroom, activeYear] = await Promise.all([
      req.body.nextClassroomId
        ? prisma.classroom.findFirst({ where: { id: req.body.nextClassroomId, institutionId: req.institutionId! } })
        : Promise.resolve(null),
      req.body.academicYearId
        ? Promise.resolve(null)
        : prisma.academicYear.findFirst({ where: { institutionId: req.institutionId!, isActive: true } })
    ])
    if (req.body.nextClassroomId && !nextClassroom) throw notFound('Classe suivante introuvable')

    const academicYearId = req.body.academicYearId ?? activeYear?.id ?? undefined
    const metadata = metadataRecord(student.metadata)
    const annualDecision = {
      decision: req.body.decision,
      academicYearId,
      nextClassroomId: nextClassroom?.id ?? null,
      nextClassroomName: nextClassroom?.name ?? null,
      comment: req.body.comment?.trim() || null,
      decidedAt: new Date().toISOString(),
      decidedById: req.user!.id
    }

    const updateData: Prisma.StudentUpdateInput = {
      metadata: {
        ...metadata,
        annualDecision
      } as Prisma.InputJsonObject
    }
    if (req.body.decision === 'GRADUATED') {
      updateData.status = StudentStatus.GRADUATED
    }
    if (req.body.applyToStudent && nextClassroom) {
      updateData.classroom = { connect: { id: nextClassroom.id } }
    }

    const updated = await prisma.student.update({
      where: { id: student.id },
      data: updateData,
      include: { classroom: { include: { gradeLevel: true } } }
    })
    res.json({ student: updated, annualDecision })
  })
)

gradesRoutes.get(
  '/',
  asyncHandler(async (req, res) => {
    const subjectId = req.query.subjectId ? String(req.query.subjectId) : undefined
    const periodId = req.query.periodId ? String(req.query.periodId) : undefined
    const classroomId = req.query.classroomId ? String(req.query.classroomId) : undefined
    const grades = await prisma.grade.findMany({
      where:
        req.user!.role === UserRole.TEACHER
          ? {
              institutionId: req.institutionId!,
              teacher: { userId: req.user!.id },
              subjectId,
              periodId,
              student: classroomId ? { classroomId } : undefined
            }
          : {
              institutionId: req.institutionId!,
              subjectId,
              periodId,
              student: classroomId ? { classroomId } : undefined
            },
      include: { student: { include: { classroom: true } }, teacher: true, subject: true, period: true },
      orderBy: { createdAt: 'desc' }
    })
    res.json({ grades })
  })
)

gradesRoutes.post(
  '/',
  requireRoles(UserRole.TEACHER),
  validate(
    z.object({
      body: z.object({
        studentId: z.string(),
        subjectId: z.string(),
        periodId: z.string().optional(),
        period: z.string().optional(),
        score: z.number().min(0).optional(),
        value: z.number().min(0).optional(),
        maxScore: z.number().positive().default(20),
        coefficient: z.number().int().positive().default(1),
        appreciation: z.string().optional(),
        comment: z.string().optional()
      })
    })
  ),
  asyncHandler(async (req, res) => {
    const teacher = await prisma.teacher.findFirst({
      where: { userId: req.user!.id, institutionId: req.institutionId! }
    })
    if (!teacher) throw forbidden('Profil professeur introuvable')

    const student = await prisma.student.findFirst({
      where: { id: req.body.studentId, institutionId: req.institutionId! }
    })
    if (!student?.classroomId) throw notFound('Élève ou classe introuvable')

    const assignment = await prisma.teacherAssignment.findFirst({
      where: {
        institutionId: req.institutionId!,
        teacherId: teacher.id,
        classroomId: student.classroomId,
        subjectId: req.body.subjectId
      }
    })
    if (!assignment) throw forbidden('Vous ne pouvez saisir que les notes de vos classes et matières assignées')
    let periodId = req.body.periodId
    if (!periodId) {
      const activeYear = await prisma.academicYear.findFirst({ where: { institutionId: req.institutionId!, isActive: true } })
      if (!activeYear) throw notFound('Année scolaire active introuvable')
      const period = await prisma.gradePeriod.upsert({
        where: {
          institutionId_academicYearId_name: {
            institutionId: req.institutionId!,
            academicYearId: activeYear.id,
            name: req.body.period ?? 'Période générale'
          }
        },
        update: {},
        create: {
          institutionId: req.institutionId!,
          academicYearId: activeYear.id,
          name: req.body.period ?? 'Période générale',
          startsAt: activeYear.startsAt,
          endsAt: activeYear.endsAt
        }
      })
      periodId = period.id
    }

    const grade = await prisma.grade.create({
      data: {
        institutionId: req.institutionId!,
        teacherId: teacher.id,
        studentId: req.body.studentId,
        subjectId: req.body.subjectId,
        periodId,
        score: req.body.score ?? req.body.value,
        maxScore: req.body.maxScore,
        coefficient: req.body.coefficient,
        appreciation: req.body.appreciation ?? req.body.comment
      }
    })

    // Notify parents asynchronously
    ;(async () => {
      try {
        const [student, subject] = await Promise.all([
          prisma.student.findUnique({
            where: { id: req.body.studentId },
            include: { classroom: true, parents: { include: { parent: { select: { phone: true, userId: true, firstName: true, email: true } } } } }
          }),
          prisma.subject.findUnique({ where: { id: req.body.subjectId }, select: { name: true } })
        ])
        if (!student || !subject) return
        const studentName = `${student.firstName} ${student.lastName}`
        const className = student.classroom?.name ?? ''
        const appName = process.env.APP_NAME ?? 'SoraSchool'
        for (const link of student.parents ?? []) {
          notifyGrade({
            institutionId: req.institutionId!,
            studentName,
            subject: subject.name,
            score: grade.score,
            maxScore: grade.maxScore,
            parentUserId: link.parent.userId ?? undefined,
            parentPhone: link.parent.phone
          }).catch(() => {})
          if (link.parent.email) {
            emailGradeAlert({
              to: link.parent.email,
              parentName: link.parent.firstName,
              studentName,
              subject: subject.name,
              score: grade.score,
              maxScore: grade.maxScore,
              className,
              appName
            }).catch(() => {})
          }
        }
      } catch { /* non-blocking */ }
    })()

    res.status(201).json({ grade })
  })
)
