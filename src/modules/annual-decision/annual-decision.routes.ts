import { Router } from 'express'
import { z } from 'zod'
import { AnnualDecisionStatus, StudentStatus, UserRole } from '@prisma/client'
import { prisma } from '../../config/prisma'
import { asyncHandler } from '../../lib/async'
import { notFound, badRequest, forbidden } from '../../lib/errors'
import { authenticate } from '../../middlewares/auth'
import { requireRoles, requireTenantUser } from '../../middlewares/rbac'
import { validate } from '../../middlewares/validate'

export const annualDecisionRoutes = Router()
annualDecisionRoutes.use(authenticate, requireTenantUser)

const directorRoles = [UserRole.DIRECTOR, UserRole.CENTRAL_ADMIN] as const
const managementRoles = [UserRole.DIRECTOR, UserRole.CENTRAL_ADMIN, UserRole.ADMINISTRATION, UserRole.SECRETARIAT] as const

async function assertNextClassroom(institutionId: string, classroomId?: string) {
  if (!classroomId) return null
  const classroom = await prisma.classroom.findFirst({
    where: { id: classroomId, institutionId },
    select: { id: true, name: true }
  })
  if (!classroom) throw notFound('Classe suivante introuvable')
  return classroom
}

// List decisions for an academic year
annualDecisionRoutes.get(
  '/',
  requireRoles(...managementRoles),
  asyncHandler(async (req, res) => {
    const { academicYearId, classroomId, status, page = '1', limit = '50' } = req.query
    const skip = (Number(page) - 1) * Number(limit)

    const where = {
      institutionId: req.institutionId!,
      ...(academicYearId ? { academicYearId: String(academicYearId) } : {}),
      ...(classroomId ? { classroomId: String(classroomId) } : {}),
      ...(status ? { finalStatus: status as AnnualDecisionStatus } : {}),
    }

    const [decisions, total] = await Promise.all([
      prisma.annualDecision.findMany({
        where,
        include: {
          student: { select: { id: true, firstName: true, lastName: true, matricule: true } },
          academicYear: { select: { id: true, name: true } },
          validatedBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: [{ classroomId: 'asc' }, { student: { lastName: 'asc' } }],
        skip,
        take: Number(limit)
      }),
      prisma.annualDecision.count({ where })
    ])

    res.json({ decisions, total, page: Number(page), limit: Number(limit) })
  })
)

annualDecisionRoutes.get(
  '/:id',
  requireRoles(...managementRoles),
  asyncHandler(async (req, res) => {
    const decision = await prisma.annualDecision.findFirst({
      where: { id: req.params.id, institutionId: req.institutionId! },
      include: {
        student: true,
        academicYear: true,
        validatedBy: { select: { id: true, firstName: true, lastName: true } },
      }
    })
    if (!decision) throw notFound('Décision introuvable')
    res.json({ decision })
  })
)

// Bulk calculate averages from grades for an academic year (based on GradePeriod → Grade)
annualDecisionRoutes.post(
  '/calculate',
  requireRoles(...directorRoles),
  validate(z.object({ body: z.object({ academicYearId: z.string() }) })),
  asyncHandler(async (req, res) => {
    const { academicYearId } = req.body
    const institutionId = req.institutionId!

    // Get all students active in this institution
    const students = await prisma.student.findMany({
      where: { institutionId, status: 'ACTIVE' },
      select: { id: true, classroomId: true }
    })

    // Get country config for passing threshold
    const institution = await prisma.institution.findUnique({
      where: { id: institutionId },
      select: { countryCode: true }
    })
    const countryConfig = institution?.countryCode
      ? await prisma.countryConfig.findUnique({ where: { code: institution.countryCode } })
      : null
    const threshold = countryConfig?.passingThreshold ?? 10

    // Get grade periods for this academic year
    const periods = await prisma.gradePeriod.findMany({
      where: { institutionId, academicYearId }
    })
    const periodIds = periods.map(p => p.id)

    const results: Array<{ studentId: string; average: number | null }> = []

    for (const student of students) {
      let grades: { score: number; maxScore: number; coefficient: number }[] = []

      if (periodIds.length > 0) {
        const gradeRecords = await prisma.grade.findMany({
          where: { institutionId, studentId: student.id, periodId: { in: periodIds } },
          select: { score: true, maxScore: true, coefficient: true }
        })
        grades = gradeRecords
      }

      let weightedSum = 0
      let totalCoef = 0

      for (const g of grades) {
        const coef = g.coefficient ?? 1
        weightedSum += (g.score / g.maxScore) * 20 * coef
        totalCoef += coef
      }

      const average = totalCoef > 0 ? Math.round((weightedSum / totalCoef) * 100) / 100 : null

      const proposedStatus = average === null
        ? AnnualDecisionStatus.PENDING
        : average >= threshold
          ? AnnualDecisionStatus.ADMITTED
          : AnnualDecisionStatus.REPEATING

      await prisma.annualDecision.upsert({
        where: { studentId_academicYearId: { studentId: student.id, academicYearId } },
        create: {
          institutionId,
          studentId: student.id,
          academicYearId,
          classroomId: student.classroomId ?? undefined,
          annualAverage: average ?? undefined,
          proposedStatus,
        },
        update: {
          annualAverage: average ?? undefined,
          proposedStatus,
          classroomId: student.classroomId ?? undefined,
        }
      })

      results.push({ studentId: student.id, average })
    }

    res.json({ ok: true, processed: results.length, results })
  })
)

// Create or update a decision manually
annualDecisionRoutes.put(
  '/student/:studentId/year/:academicYearId',
  requireRoles(...managementRoles),
  validate(z.object({
    body: z.object({
      classroomId: z.string().optional(),
      annualAverage: z.number().optional(),
      proposedStatus: z.nativeEnum(AnnualDecisionStatus).optional(),
      finalStatus: z.nativeEnum(AnnualDecisionStatus).optional(),
      nextClassroomId: z.string().optional(),
      notes: z.string().optional(),
    })
  })),
  asyncHandler(async (req, res) => {
    const { studentId, academicYearId } = req.params
    const institutionId = req.institutionId!
    const [student, nextClassroom] = await Promise.all([
      prisma.student.findFirst({ where: { id: studentId, institutionId }, select: { id: true } }),
      assertNextClassroom(institutionId, req.body.nextClassroomId)
    ])

    if (!student) throw notFound('Élève introuvable')
    if (req.body.finalStatus && !directorRoles.includes(req.user!.role as (typeof directorRoles)[number])) {
      throw forbidden('Seul le Directeur peut valider une décision annuelle finale')
    }
    const validationFields = req.body.finalStatus
      ? { validatedById: req.user!.id, validatedAt: new Date() }
      : {}

    const decision = await prisma.annualDecision.upsert({
      where: { studentId_academicYearId: { studentId, academicYearId } },
      create: {
        institutionId,
        studentId,
        academicYearId,
        ...req.body,
        nextClassroomId: nextClassroom?.id,
        ...validationFields
      },
      update: {
        ...req.body,
        nextClassroomId: nextClassroom?.id,
        ...validationFields
      }
    })

    await prisma.auditLog.create({
      data: {
        institutionId,
        actorId: req.user!.id,
        action: 'ANNUAL_DECISION_UPDATED',
        entity: 'AnnualDecision',
        entityId: decision.id,
        metadata: {
          studentId,
          academicYearId,
          finalStatus: decision.finalStatus,
          proposedStatus: decision.proposedStatus,
          nextClassroomId: decision.nextClassroomId
        }
      }
    })

    res.json({ decision })
  })
)

// Validate (finalize) a decision — Director only
annualDecisionRoutes.post(
  '/:id/validate',
  requireRoles(...directorRoles),
  validate(z.object({
    body: z.object({
      finalStatus: z.nativeEnum(AnnualDecisionStatus),
      nextClassroomId: z.string().optional(),
      notes: z.string().optional(),
    })
  })),
  asyncHandler(async (req, res) => {
    const existing = await prisma.annualDecision.findFirst({
      where: { id: req.params.id, institutionId: req.institutionId! }
    })
    if (!existing) throw notFound('Décision introuvable')
    const nextClassroom = await assertNextClassroom(req.institutionId!, req.body.nextClassroomId)

    const decision = await prisma.annualDecision.update({
      where: { id: req.params.id },
      data: {
        finalStatus: req.body.finalStatus,
        nextClassroomId: nextClassroom?.id,
        notes: req.body.notes,
        validatedById: req.user!.id,
        validatedAt: new Date(),
      }
    })

    await prisma.auditLog.create({
      data: {
        institutionId: req.institutionId!,
        actorId: req.user!.id,
        action: 'ANNUAL_DECISION_VALIDATED',
        entity: 'AnnualDecision',
        entityId: decision.id,
        metadata: { finalStatus: decision.finalStatus, studentId: decision.studentId }
      }
    })

    res.json({ decision })
  })
)

// Bulk validate all PENDING decisions for a year
annualDecisionRoutes.post(
  '/bulk-validate',
  requireRoles(...directorRoles),
  validate(z.object({ body: z.object({ academicYearId: z.string() }) })),
  asyncHandler(async (req, res) => {
    const { academicYearId } = req.body
    const institutionId = req.institutionId!

    const pending = await prisma.annualDecision.findMany({
      where: { institutionId, academicYearId, finalStatus: null }
    })

    let count = 0
    for (const d of pending) {
      if (d.proposedStatus !== AnnualDecisionStatus.PENDING) {
        const decision = await prisma.annualDecision.update({
          where: { id: d.id },
          data: { finalStatus: d.proposedStatus, validatedById: req.user!.id, validatedAt: new Date() }
        })
        await prisma.auditLog.create({
          data: {
            institutionId,
            actorId: req.user!.id,
            action: 'ANNUAL_DECISION_VALIDATED',
            entity: 'AnnualDecision',
            entityId: decision.id,
            metadata: { finalStatus: decision.finalStatus, studentId: decision.studentId, bulk: true }
          }
        })
        count++
      }
    }

    res.json({ ok: true, validated: count })
  })
)

annualDecisionRoutes.post(
  '/promote',
  requireRoles(...directorRoles),
  validate(z.object({ body: z.object({ academicYearId: z.string() }) })),
  asyncHandler(async (req, res) => {
    const { academicYearId } = req.body
    const institutionId = req.institutionId!

    const decisions = await prisma.annualDecision.findMany({
      where: {
        institutionId,
        academicYearId,
        validatedAt: { not: null },
        finalStatus: {
          in: [
            AnnualDecisionStatus.ADMITTED,
            AnnualDecisionStatus.REPEATING,
            AnnualDecisionStatus.TRANSFERRED,
            AnnualDecisionStatus.EXCLUDED,
            AnnualDecisionStatus.GRADUATED
          ]
        }
      },
      include: {
        student: { select: { id: true, classroomId: true, status: true } }
      }
    })

    if (decisions.length === 0) {
      throw badRequest('Aucune décision validée à appliquer pour cette année scolaire')
    }

    let promoted = 0
    let repeated = 0
    let transferred = 0
    let excluded = 0
    let graduated = 0

    for (const decision of decisions) {
      if (decision.finalStatus === AnnualDecisionStatus.ADMITTED) {
        if (!decision.nextClassroomId) continue
        await prisma.student.update({
          where: { id: decision.studentId },
          data: {
            classroomId: decision.nextClassroomId,
            status: StudentStatus.ACTIVE
          }
        })
        promoted++
      } else if (decision.finalStatus === AnnualDecisionStatus.REPEATING) {
        if (!decision.nextClassroomId) continue
        await prisma.student.update({
          where: { id: decision.studentId },
          data: {
            classroomId: decision.nextClassroomId,
            status: StudentStatus.ACTIVE
          }
        })
        repeated++
      } else if (decision.finalStatus === AnnualDecisionStatus.TRANSFERRED) {
        await prisma.student.update({
          where: { id: decision.studentId },
          data: { status: StudentStatus.TRANSFERRED }
        })
        transferred++
      } else if (decision.finalStatus === AnnualDecisionStatus.EXCLUDED) {
        await prisma.student.update({
          where: { id: decision.studentId },
          data: { status: StudentStatus.SUSPENDED }
        })
        excluded++
      } else if (decision.finalStatus === AnnualDecisionStatus.GRADUATED) {
        await prisma.student.update({
          where: { id: decision.studentId },
          data: { status: StudentStatus.GRADUATED }
        })
        graduated++
      }

      await prisma.auditLog.create({
        data: {
          institutionId,
          actorId: req.user!.id,
          action: 'STUDENT_PROMOTED_FROM_ANNUAL_DECISION',
          entity: 'AnnualDecision',
          entityId: decision.id,
          metadata: {
            studentId: decision.studentId,
            academicYearId,
            finalStatus: decision.finalStatus,
            nextClassroomId: decision.nextClassroomId
          }
        }
      })
    }

    res.json({
      ok: true,
      summary: { promoted, repeated, transferred, excluded, graduated, totalApplied: promoted + repeated + transferred + excluded + graduated }
    })
  })
)

// Statistics for a year
annualDecisionRoutes.get(
  '/stats/:academicYearId',
  requireRoles(...managementRoles),
  asyncHandler(async (req, res) => {
    const { academicYearId } = req.params
    const institutionId = req.institutionId!

    const [total, admitted, repeating, transferred, excluded, graduated, pending] = await Promise.all([
      prisma.annualDecision.count({ where: { institutionId, academicYearId } }),
      prisma.annualDecision.count({ where: { institutionId, academicYearId, finalStatus: AnnualDecisionStatus.ADMITTED } }),
      prisma.annualDecision.count({ where: { institutionId, academicYearId, finalStatus: AnnualDecisionStatus.REPEATING } }),
      prisma.annualDecision.count({ where: { institutionId, academicYearId, finalStatus: AnnualDecisionStatus.TRANSFERRED } }),
      prisma.annualDecision.count({ where: { institutionId, academicYearId, finalStatus: AnnualDecisionStatus.EXCLUDED } }),
      prisma.annualDecision.count({ where: { institutionId, academicYearId, finalStatus: AnnualDecisionStatus.GRADUATED } }),
      prisma.annualDecision.count({ where: { institutionId, academicYearId, finalStatus: null } }),
    ])

    res.json({ stats: { total, admitted, repeating, transferred, excluded, graduated, pending } })
  })
)
