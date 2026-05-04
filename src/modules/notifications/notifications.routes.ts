import { Router } from 'express'
import { UserRole } from '@prisma/client'
import { prisma } from '../../config/prisma'
import { asyncHandler } from '../../lib/async'
import { authenticate } from '../../middlewares/auth'
import { requireTenantUser } from '../../middlewares/rbac'

export const notificationsRoutes = Router()
notificationsRoutes.use(authenticate, requireTenantUser)

notificationsRoutes.get(
  '/',
  asyncHandler(async (req, res) => {
    const userId = req.user!.id
    const institutionId = req.institutionId!
    const limit = Math.min(Number(req.query.limit ?? 50), 100)
    const unreadOnly = req.query.unread === 'true'

    const notifications = await prisma.notification.findMany({
      where: {
        institutionId,
        userId,
        ...(unreadOnly ? { readAt: null } : {})
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    })

    const unreadCount = await prisma.notification.count({
      where: { institutionId, userId, readAt: null }
    })

    res.json({ notifications, unreadCount })
  })
)

notificationsRoutes.post(
  '/mark-read',
  asyncHandler(async (req, res) => {
    const userId = req.user!.id
    const institutionId = req.institutionId!
    const ids: string[] = req.body.ids ?? []

    if (ids.length > 0) {
      await prisma.notification.updateMany({
        where: { institutionId, userId, id: { in: ids }, readAt: null },
        data: { readAt: new Date() }
      })
    } else {
      await prisma.notification.updateMany({
        where: { institutionId, userId, readAt: null },
        data: { readAt: new Date() }
      })
    }

    res.json({ ok: true })
  })
)
