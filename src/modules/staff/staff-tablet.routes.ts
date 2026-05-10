import rateLimit from 'express-rate-limit'
import { Router } from 'express'
import { z } from 'zod'
import { StaffAttendanceMethod, StaffTabletLinkStatus } from '@prisma/client'
import { prisma } from '../../config/prisma'
import { asyncHandler } from '../../lib/async'
import { forbidden } from '../../lib/errors'
import { validate } from '../../middlewares/validate'
import { resolveStaffQrPayload, scanStaffAttendance, tokenHash } from './staff.service'

export const staffTabletRoutes = Router()

staffTabletRoutes.use(rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false
}))

async function resolveTabletLink(token: string) {
  const link = await prisma.staffTabletLink.findUnique({
    where: { tokenHash: tokenHash(token) },
    include: { institution: { select: { id: true, name: true, logoUrl: true, status: true, city: true, country: true } } }
  })
  if (!link || link.status !== StaffTabletLinkStatus.ACTIVE || link.expiresAt < new Date()) {
    throw forbidden('Lien de pointage expiré ou désactivé. Veuillez contacter la Direction.')
  }
  return link
}

staffTabletRoutes.get(
  '/:token',
  asyncHandler(async (req, res) => {
    const link = await resolveTabletLink(req.params.token)
    await prisma.staffTabletScanLog.create({
      data: {
        institutionId: link.institutionId,
        tabletLinkId: link.id,
        action: 'TABLET_LINK_OPENED',
        result: 'OK',
        ip: req.ip,
        userAgent: req.get('user-agent'),
        idempotencyKey: req.get('Idempotency-Key') ?? undefined
      }
    }).catch(() => undefined)
    res.json({
      link: {
        id: link.id,
        expiresAt: link.expiresAt,
        status: link.status
      },
      institution: link.institution
    })
  })
)

staffTabletRoutes.post(
  '/:token/scan',
  validate(z.object({ body: z.object({ qrPayload: z.string().min(20) }) })),
  asyncHandler(async (req, res) => {
    const link = await resolveTabletLink(req.params.token)
    try {
      const staff = await resolveStaffQrPayload(req.body.qrPayload, link.institutionId)
      const result = await scanStaffAttendance({
        institutionId: link.institutionId,
        staffId: staff.id,
        method: StaffAttendanceMethod.TABLET_QR,
        tabletLinkId: link.id,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        idempotencyKey: req.get('Idempotency-Key') ?? undefined
      })
      await prisma.staffTabletLink.update({
        where: { id: link.id },
        data: { lastUsedAt: new Date(), usageCount: { increment: 1 } }
      })
      await prisma.staffTabletScanLog.create({
        data: {
          institutionId: link.institutionId,
          tabletLinkId: link.id,
          staffId: staff.id,
          action: 'TABLET_QR_SCAN',
          result: result.result,
          message: result.message,
          ip: req.ip,
          userAgent: req.get('user-agent'),
          idempotencyKey: req.get('Idempotency-Key') ?? undefined
        }
      })
      res.status(201).json({
        ...result,
        staff: {
          id: result.staff.id,
          firstName: result.staff.firstName,
          lastName: result.staff.lastName,
          photoUrl: result.staff.photoUrl,
          position: result.staff.position,
          customPosition: result.staff.customPosition
        }
      })
    } catch (err) {
      await prisma.staffTabletScanLog.create({
        data: {
          institutionId: link.institutionId,
          tabletLinkId: link.id,
          action: 'TABLET_QR_SCAN_REFUSED',
          result: 'REFUSED',
          message: err instanceof Error ? err.message : 'Scan refusé',
          ip: req.ip,
          userAgent: req.get('user-agent'),
          idempotencyKey: req.get('Idempotency-Key') ?? undefined
        }
      }).catch(() => undefined)
      throw err
    }
  })
)
