import { Router } from 'express'
import { z } from 'zod'
import { UserRole } from '@prisma/client'
import { prisma } from '../../config/prisma'
import { asyncHandler } from '../../lib/async'
import { badRequest, forbidden } from '../../lib/errors'
import { authenticate } from '../../middlewares/auth'
import { requireTenantUser, requireRoles } from '../../middlewares/rbac'
import { validate } from '../../middlewares/validate'

export const teacherBadgesRoutes = Router()
teacherBadgesRoutes.use(authenticate, requireTenantUser)

function todayRange() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start, end }
}

teacherBadgesRoutes.post(
  '/check-in',
  asyncHandler(async (req, res) => {
    const institutionId = req.institutionId!
    const now = new Date()
    const { start, end } = todayRange()

    let teacherId: string
    if (req.user!.role === UserRole.TEACHER) {
      const teacher = await prisma.teacher.findFirst({ where: { userId: req.user!.id, institutionId } })
      if (!teacher) throw forbidden('Profil enseignant introuvable')
      teacherId = teacher.id
    } else {
      if (!req.body.teacherId) throw badRequest('teacherId requis')
      teacherId = String(req.body.teacherId)
    }

    const existing = await prisma.teacherBadge.findFirst({
      where: { institutionId, teacherId, date: { gte: start, lt: end } }
    })

    if (existing?.checkInAt) {
      return res.json({ badge: existing, message: 'Déjà pointé aujourd\'hui' })
    }

    const badge = existing
      ? await prisma.teacherBadge.update({
          where: { id: existing.id },
          data: { checkInAt: now }
        })
      : await prisma.teacherBadge.create({
          data: {
            institutionId,
            teacherId,
            date: start,
            checkInAt: now
          }
        })

    res.status(201).json({ badge })
  })
)

teacherBadgesRoutes.post(
  '/check-out',
  asyncHandler(async (req, res) => {
    const institutionId = req.institutionId!
    const now = new Date()
    const { start, end } = todayRange()

    let teacherId: string
    if (req.user!.role === UserRole.TEACHER) {
      const teacher = await prisma.teacher.findFirst({ where: { userId: req.user!.id, institutionId } })
      if (!teacher) throw forbidden('Profil enseignant introuvable')
      teacherId = teacher.id
    } else {
      if (!req.body.teacherId) throw badRequest('teacherId requis')
      teacherId = String(req.body.teacherId)
    }

    const badge = await prisma.teacherBadge.findFirst({
      where: { institutionId, teacherId, date: { gte: start, lt: end } }
    })

    if (!badge) throw badRequest('Aucun pointage d\'entrée trouvé aujourd\'hui')
    if (badge.checkOutAt) return res.json({ badge, message: 'Déjà sorti aujourd\'hui' })

    const updated = await prisma.teacherBadge.update({
      where: { id: badge.id },
      data: { checkOutAt: now }
    })

    res.json({ badge: updated })
  })
)

teacherBadgesRoutes.get(
  '/',
  requireRoles(UserRole.DIRECTOR, UserRole.ADMINISTRATION),
  validate(z.object({ query: z.object({ teacherId: z.string().optional(), date: z.string().optional(), month: z.string().optional() }) })),
  asyncHandler(async (req, res) => {
    const institutionId = req.institutionId!
    const { teacherId, date, month } = req.query as Record<string, string | undefined>

    let dateFilter: { gte: Date; lt: Date } | undefined
    if (date) {
      const d = new Date(date)
      if (Number.isNaN(d.getTime())) throw badRequest('Date invalide')
      d.setHours(0, 0, 0, 0)
      const end = new Date(d)
      end.setDate(end.getDate() + 1)
      dateFilter = { gte: d, lt: end }
    } else if (month) {
      const [year, m] = month.split('-').map(Number)
      const start = new Date(year, m - 1, 1)
      const end = new Date(year, m, 1)
      dateFilter = { gte: start, lt: end }
    }

    const badges = await prisma.teacherBadge.findMany({
      where: {
        institutionId,
        ...(teacherId ? { teacherId } : {}),
        ...(dateFilter ? { date: dateFilter } : {})
      },
      include: { teacher: { select: { id: true, firstName: true, lastName: true, matricule: true } } },
      orderBy: [{ date: 'desc' }, { checkInAt: 'desc' }]
    })

    res.json({ badges })
  })
)

teacherBadgesRoutes.get(
  '/my',
  asyncHandler(async (req, res) => {
    const institutionId = req.institutionId!
    const teacher = await prisma.teacher.findFirst({ where: { userId: req.user!.id, institutionId } })
    if (!teacher) throw forbidden('Profil enseignant introuvable')

    const month = req.query.month ? String(req.query.month) : undefined
    let dateFilter: { gte: Date; lt: Date } | undefined
    if (month) {
      const [year, m] = month.split('-').map(Number)
      const start = new Date(year, m - 1, 1)
      const end = new Date(year, m, 1)
      dateFilter = { gte: start, lt: end }
    } else {
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      dateFilter = { gte: start, lt: end }
    }

    const badges = await prisma.teacherBadge.findMany({
      where: { institutionId, teacherId: teacher.id, date: dateFilter },
      orderBy: { date: 'desc' }
    })

    res.json({ badges })
  })
)
