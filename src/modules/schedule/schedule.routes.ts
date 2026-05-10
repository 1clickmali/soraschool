import { Router } from 'express'
import { z } from 'zod'
import { UserRole } from '@prisma/client'
import { prisma } from '../../config/prisma'
import { asyncHandler } from '../../lib/async'
import { badRequest, forbidden, notFound } from '../../lib/errors'
import { assertCanAccessEstablishment, getScopedEstablishmentId } from '../../lib/access-scope'
import { assertSubjectCompatibleWithClassroom } from '../../lib/curriculum-compatibility'
import { authenticate } from '../../middlewares/auth'
import { requireRoles, requireTenantUser } from '../../middlewares/rbac'
import { validate } from '../../middlewares/validate'

export const scheduleRoutes = Router()
scheduleRoutes.use(authenticate, requireTenantUser)

const writeRoles = [UserRole.CENTRAL_ADMIN, UserRole.DIRECTOR, UserRole.ADMINISTRATION, UserRole.SECRETARIAT] as const

scheduleRoutes.get(
  '/',
  asyncHandler(async (req, res) => {
    const classroomId = typeof req.query.classroomId === 'string' ? req.query.classroomId : undefined
    const requestedTeacherId = typeof req.query.teacherId === 'string' ? req.query.teacherId : undefined
    const currentTeacher = req.user!.role === UserRole.TEACHER
      ? await prisma.teacher.findFirst({ where: { institutionId: req.institutionId!, userId: req.user!.id }, select: { id: true } })
      : null
    const teacherId = currentTeacher?.id ?? requestedTeacherId
    const subjectId = typeof req.query.subjectId === 'string' ? req.query.subjectId : undefined
    const dayOfWeek = req.query.dayOfWeek ? Number(req.query.dayOfWeek) : undefined
    const search = typeof req.query.search === 'string' ? req.query.search : undefined

    const slots = await prisma.scheduleSlot.findMany({
      where: {
        institutionId: req.institutionId!,
        classroomId,
        teacherId,
        subjectId,
        dayOfWeek,
        classroom: getScopedEstablishmentId(req)
          ? { establishmentId: getScopedEstablishmentId(req) }
          : undefined,
        OR: search
          ? [
              { room: { contains: search, mode: 'insensitive' } },
              { classroom: { name: { contains: search, mode: 'insensitive' } } },
              { subject: { name: { contains: search, mode: 'insensitive' } } },
              { teacher: { firstName: { contains: search, mode: 'insensitive' } } },
              { teacher: { lastName: { contains: search, mode: 'insensitive' } } }
            ]
          : undefined
      },
      include: { classroom: true, teacher: true, subject: true },
      orderBy: [{ dayOfWeek: 'asc' }, { startsAt: 'asc' }]
    })
    res.json({ slots })
  })
)

scheduleRoutes.post(
  '/',
  requireRoles(...writeRoles),
  validate(
    z.object({
      body: z.object({
        classroomId: z.string(),
        teacherId: z.string().optional(),
        subjectId: z.string().optional(),
        room: z.string().optional(),
        dayOfWeek: z.number().int().min(1).max(7),
        startsAt: z.string().regex(/^\d{2}:\d{2}$/),
        endsAt: z.string().regex(/^\d{2}:\d{2}$/),
        notes: z.string().optional()
      })
    })
  ),
  asyncHandler(async (req, res) => {
    if (req.body.startsAt >= req.body.endsAt) throw badRequest("L'heure de fin doit être après l'heure de début")
    const scopedEstablishmentId = getScopedEstablishmentId(req)
    const [classroom, teacher, subject] = await Promise.all([
      prisma.classroom.findFirst({
        where: {
          id: req.body.classroomId,
          institutionId: req.institutionId!,
          establishmentId: scopedEstablishmentId ?? undefined
        }
      }),
      req.body.teacherId
        ? prisma.teacher.findFirst({
            where: {
              id: req.body.teacherId,
              institutionId: req.institutionId!,
              establishmentId: scopedEstablishmentId ?? undefined,
              status: 'ACTIVE'
            }
          })
        : Promise.resolve(null),
      req.body.subjectId
        ? prisma.subject.findFirst({
            where: { id: req.body.subjectId, institutionId: req.institutionId!, isActive: true }
          })
        : Promise.resolve(null)
    ])

    if (!classroom) throw notFound('Classe introuvable')
    if (req.body.teacherId && !teacher) throw notFound('Enseignant introuvable')
    if (req.body.subjectId && !subject) throw notFound('Matière introuvable ou archivée')

    await assertSubjectCompatibleWithClassroom({
      institutionId: req.institutionId!,
      classroomId: classroom.id,
      subjectId: subject?.id
    })

    await assertNoScheduleConflict(req.institutionId!, {
      classroomId: classroom.id,
      teacherId: teacher?.id,
      dayOfWeek: req.body.dayOfWeek,
      startsAt: req.body.startsAt,
      endsAt: req.body.endsAt
    })

    const slot = await prisma.scheduleSlot.create({
      data: {
        institutionId: req.institutionId!,
        classroomId: classroom.id,
        teacherId: teacher?.id,
        subjectId: subject?.id,
        room: req.body.room,
        dayOfWeek: req.body.dayOfWeek,
        startsAt: req.body.startsAt,
        endsAt: req.body.endsAt,
        notes: req.body.notes
      },
      include: { classroom: true, teacher: true, subject: true }
    })
    res.status(201).json({ slot })
  })
)

scheduleRoutes.patch(
  '/:id',
  requireRoles(...writeRoles),
  validate(
    z.object({
      params: z.object({ id: z.string() }),
      body: z.object({
        classroomId: z.string().optional(),
        teacherId: z.string().nullable().optional(),
        subjectId: z.string().nullable().optional(),
        room: z.string().nullable().optional(),
        dayOfWeek: z.number().int().min(1).max(7).optional(),
        startsAt: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        endsAt: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        notes: z.string().nullable().optional()
      })
    })
  ),
  asyncHandler(async (req, res) => {
    const existing = await prisma.scheduleSlot.findFirst({
      where: { id: req.params.id, institutionId: req.institutionId! },
      include: { classroom: { select: { establishmentId: true } } }
    })
    if (!existing) throw notFound('Créneau introuvable')

    assertCanAccessEstablishment(req, existing.classroom.establishmentId)

    const scopedEstablishmentId = getScopedEstablishmentId(req)
    const nextClassroomId = req.body.classroomId ?? existing.classroomId
    const nextTeacherId = req.body.teacherId === null ? undefined : req.body.teacherId ?? existing.teacherId ?? undefined
    const nextSubjectId = req.body.subjectId === null ? undefined : req.body.subjectId ?? existing.subjectId ?? undefined

    const [classroom, teacher, subject] = await Promise.all([
      prisma.classroom.findFirst({
        where: {
          id: nextClassroomId,
          institutionId: req.institutionId!,
          establishmentId: scopedEstablishmentId ?? undefined
        }
      }),
      nextTeacherId
        ? prisma.teacher.findFirst({
            where: {
              id: nextTeacherId,
              institutionId: req.institutionId!,
              establishmentId: scopedEstablishmentId ?? undefined,
              status: 'ACTIVE'
            }
          })
        : Promise.resolve(null),
      nextSubjectId
        ? prisma.subject.findFirst({
            where: { id: nextSubjectId, institutionId: req.institutionId!, isActive: true }
          })
        : Promise.resolve(null)
    ])

    if (!classroom) throw notFound('Classe introuvable')
    if (nextTeacherId && !teacher) throw notFound('Enseignant introuvable')
    if (nextSubjectId && !subject) throw notFound('Matière introuvable ou archivée')

    const startsAt = req.body.startsAt ?? existing.startsAt
    const endsAt = req.body.endsAt ?? existing.endsAt
    if (startsAt >= endsAt) throw badRequest("L'heure de fin doit être après l'heure de début")

    await assertSubjectCompatibleWithClassroom({
      institutionId: req.institutionId!,
      classroomId: classroom.id,
      subjectId: subject?.id
    })

    await assertNoScheduleConflict(
      req.institutionId!,
      {
        classroomId: classroom.id,
        teacherId: teacher?.id,
        dayOfWeek: req.body.dayOfWeek ?? existing.dayOfWeek,
        startsAt,
        endsAt
      },
      existing.id
    )

    const slot = await prisma.scheduleSlot.update({
      where: { id: existing.id },
      data: {
        classroomId: classroom.id,
        teacherId: req.body.teacherId === null ? null : teacher?.id,
        subjectId: req.body.subjectId === null ? null : subject?.id,
        room: req.body.room === null ? null : req.body.room,
        dayOfWeek: req.body.dayOfWeek,
        startsAt: req.body.startsAt,
        endsAt: req.body.endsAt,
        notes: req.body.notes === null ? null : req.body.notes
      },
      include: { classroom: true, teacher: true, subject: true }
    })
    res.json({ slot })
  })
)

scheduleRoutes.delete(
  '/:id',
  requireRoles(...writeRoles),
  asyncHandler(async (req, res) => {
    const slot = await prisma.scheduleSlot.findFirst({
      where: { id: req.params.id, institutionId: req.institutionId! },
      include: { classroom: { select: { establishmentId: true } } }
    })
    if (!slot) throw notFound('Créneau introuvable')
    assertCanAccessEstablishment(req, slot.classroom.establishmentId)
    await prisma.scheduleSlot.delete({ where: { id: slot.id } })
    res.json({ ok: true })
  })
)

async function assertNoScheduleConflict(
  institutionId: string,
  input: { classroomId?: string; teacherId?: string; dayOfWeek?: number; startsAt?: string; endsAt?: string },
  excludeId?: string
) {
  if (!input.dayOfWeek || !input.startsAt || !input.endsAt) return
  const ownershipConditions = [
    input.classroomId ? { classroomId: input.classroomId } : undefined,
    input.teacherId ? { teacherId: input.teacherId } : undefined
  ].filter(Boolean) as Array<{ classroomId?: string; teacherId?: string }>
  if (!ownershipConditions.length) return
  const conflicts = await prisma.scheduleSlot.findMany({
    where: {
      institutionId,
      id: excludeId ? { not: excludeId } : undefined,
      dayOfWeek: input.dayOfWeek,
      OR: ownershipConditions,
      startsAt: { lt: input.endsAt },
      endsAt: { gt: input.startsAt }
    }
  })
  if (conflicts.length) {
    throw forbidden('Conflit horaire détecté pour cette classe ou ce professeur')
  }
}
