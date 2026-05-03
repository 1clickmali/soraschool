import type { NextFunction, Request, Response } from 'express'
import { prisma } from '../config/prisma'

export function audit(action: string, entity: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    res.on('finish', () => {
      if (res.statusCode >= 400) return
      void prisma.auditLog.create({
        data: {
          institutionId: req.institutionId ?? req.user?.institutionId ?? null,
          actorId: req.user?.id ?? null,
          action,
          entity,
          entityId: req.params.id,
          ip: req.ip,
          userAgent: req.get('user-agent'),
          metadata: { method: req.method, path: req.originalUrl }
        }
      })
    })
    next()
  }
}
