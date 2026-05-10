import type { Request } from 'express'
import { prisma } from '../config/prisma'
import { env } from '../config/env'
import { badRequest } from './errors'
import { normalizePhone } from './security'
import { sendNotification } from './notifications'
import { writeAuditLog } from './audit'

export type ParentDocumentChannel = 'WHATSAPP' | 'SMS' | 'IN_APP'
export type ParentDocumentType = 'INVOICE' | 'RECEIPT' | 'REPORT_CARD'

export interface ParentDocumentShareRecipient {
  parentId: string
  parentName: string
  phone: string
  userId?: string | null
  whatsappUrl?: string
  smsUrl?: string
  status: 'READY' | 'SENT' | 'NO_APP_ACCOUNT'
}

function phoneForWhatsapp(phone: string) {
  return normalizePhone(phone).replace(/\D/g, '')
}

function whatsappUrl(phone: string, message: string) {
  return `https://wa.me/${phoneForWhatsapp(phone)}?text=${encodeURIComponent(message)}`
}

function smsUrl(phone: string, message: string) {
  return `sms:${normalizePhone(phone)}?body=${encodeURIComponent(message)}`
}

export function parentAppUrl(slug: string, section: 'paiements' | 'bulletins') {
  return new URL(`/${slug}/parent/${section}`, env.FRONTEND_URL).toString()
}

export async function shareParentDocument(input: {
  institutionId: string
  actorId?: string
  req?: Request
  studentId: string
  studentName: string
  documentType: ParentDocumentType
  entityId: string
  channel: ParentDocumentChannel
  title: string
  body: string
  message: string
  documentUrl: string
  appUrl: string
  metadata?: Record<string, unknown>
}) {
  const parentLinks = await prisma.studentParent.findMany({
    where: { institutionId: input.institutionId, studentId: input.studentId },
    include: {
      parent: {
        select: { id: true, firstName: true, lastName: true, phone: true, userId: true }
      }
    },
    orderBy: [{ isPrimary: 'desc' }]
  })

  if (parentLinks.length === 0) {
    throw badRequest("Aucun parent n'est lié à cet élève")
  }

  const recipients: ParentDocumentShareRecipient[] = []
  const data = {
    documentType: input.documentType,
    entityId: input.entityId,
    studentId: input.studentId,
    studentName: input.studentName,
    documentUrl: input.documentUrl,
    appUrl: input.appUrl,
    ...(input.metadata ?? {})
  }

  for (const link of parentLinks) {
    const parentName = `${link.parent.firstName} ${link.parent.lastName}`.trim()

    if (input.channel === 'IN_APP' && !link.parent.userId) {
      recipients.push({
        parentId: link.parent.id,
        parentName,
        phone: link.parent.phone,
        userId: link.parent.userId,
        status: 'NO_APP_ACCOUNT'
      })
      continue
    }

    await sendNotification({
      institutionId: input.institutionId,
      userId: link.parent.userId ?? undefined,
      level: input.documentType === 'RECEIPT' ? 'SUCCESS' : 'INFO',
      channel: input.channel,
      title: input.title,
      body: input.body,
      data,
      phone: input.channel === 'SMS' ? link.parent.phone : undefined,
      smsMessage: input.channel === 'SMS' ? input.message : undefined
    })

    recipients.push({
      parentId: link.parent.id,
      parentName,
      phone: link.parent.phone,
      userId: link.parent.userId,
      whatsappUrl: input.channel === 'WHATSAPP' ? whatsappUrl(link.parent.phone, input.message) : undefined,
      smsUrl: input.channel === 'SMS' ? smsUrl(link.parent.phone, input.message) : undefined,
      status: input.channel === 'SMS' || input.channel === 'IN_APP' ? 'SENT' : 'READY'
    })
  }

  await writeAuditLog({
    institutionId: input.institutionId,
    actorId: input.actorId,
    action: 'PARENT_DOCUMENT_SHARED',
    entity: input.documentType,
    entityId: input.entityId,
    req: input.req,
    metadata: {
      channel: input.channel,
      studentId: input.studentId,
      recipients: recipients.map((recipient) => ({
        parentId: recipient.parentId,
        userId: recipient.userId,
        status: recipient.status
      }))
    }
  })

  return {
    ok: true,
    channel: input.channel,
    documentType: input.documentType,
    documentUrl: input.documentUrl,
    appUrl: input.appUrl,
    message: input.message,
    recipients
  }
}
