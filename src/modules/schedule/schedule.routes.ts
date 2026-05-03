import { Router } from 'express'
import { z } from 'zod'
import { UserRole } from '@prisma/client'
import { prisma } from '../../config/prisma'
import { asyncHandler } from '../../lib/async'
import { badRequest, forbidden } from '../../lib/errors'
import { authenticate } from '../../middlewares/auth'
import { requireRoles, requireTenantUser } from '../../middlewares/rbac'
import { validate } from '../../middlewares/validate'

export const scheduleRoutes = Router()
scheduleRoutes.use(authenticate, requireTenantUser)

const writeRoles = [UserRole.DIRECTOR, UserRole.ADMINISTRATION, UserRole.SECRETARIAT] as const

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
    await assertNoScheduleConflict(req.institutionId!, req.body)
    const slot = await prisma.scheduleSlot.create({
      data: { institutionId: req.institutionId!, ...req.body },
      include: { classroom: true, teacher: true, subject: true }
    })
    res.status(201).json({ slot })
  })
)

scheduleRoutes.patch(
  '/:id',
  requireRoles(...writeRoles),
  asyncHandler(async (req, res) => {
    await assertNoScheduleConflict(req.institutionId!, req.body, req.params.id)
    const slot = await prisma.scheduleSlot.update({
      where: { id: req.params.id },
      data: req.body,
      include: { classroom: true, teacher: true, subject: true }
    })
    res.json({ slot })
  })
)

scheduleRoutes.delete(
  '/:id',
  requireRoles(...writeRoles),
  asyncHandler(async (req, res) => {
    await prisma.scheduleSlot.delete({ where: { id: req.params.id } })
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
