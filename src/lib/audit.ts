import type { Request } from 'express'
import { prisma } from '../config/prisma'

export async function writeAuditLog(input: {
  institutionId?: string | null
  actorId?: string | null
  action: string
  entity: string
  entityId?: string | null
  metadata?: unknown
  req?: Request
}) {
  await prisma.auditLog
    .create({
      data: {
        institutionId: input.institutionId ?? null,
        actorId: input.actorId ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        ip: input.req?.ip,
        userAgent: input.req?.get('user-agent'),
        metadata: input.metadata as never
      }
    })
    .catch(() => undefined)
}
