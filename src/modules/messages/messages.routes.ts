import { Router } from 'express'
import { z } from 'zod'
import { ConversationType, UserRole } from '@prisma/client'
import { prisma } from '../../config/prisma'
import { asyncHandler } from '../../lib/async'
import { badRequest, forbidden, notFound } from '../../lib/errors'
import { normalizePhone } from '../../lib/security'
import { authenticate } from '../../middlewares/auth'
import { requireTenantUser } from '../../middlewares/rbac'
import { validate } from '../../middlewares/validate'

export const messagesRoutes = Router()
messagesRoutes.use(authenticate, requireTenantUser)

messagesRoutes.get(
  '/conversations',
  asyncHandler(async (req, res) => {
    const conversations = await prisma.conversation.findMany({
      where: {
        institutionId: req.institutionId!,
        members: { some: { userId: req.user!.id } }
      },
      include: {
        members: { include: { user: { select: { id: true, firstName: true, lastName: true, role: true, avatarUrl: true } } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 }
      },
      orderBy: { updatedAt: 'desc' }
    })
    res.json({ conversations })
  })
)

messagesRoutes.post(
  '/conversations/private',
  validate(z.object({ body: z.object({ recipientId: z.string().optional(), phone: z.string().optional() }) })),
  asyncHandler(async (req, res) => {
    if (!req.body.recipientId && !req.body.phone) throw badRequest('Destinataire requis')
    const recipient = await prisma.user.findFirst({
      where: {
        id: req.body.recipientId,
        phone: req.body.phone ? normalizePhone(req.body.phone) : undefined,
        institutionId: req.institutionId!,
        isActive: true
      }
    })
    if (!recipient) throw notFound('Destinataire introuvable')

    const conversation = await prisma.conversation.create({
      data: {
        institutionId: req.institutionId!,
        type: ConversationType.PRIVATE,
        createdById: req.user!.id,
        members: {
          create: [{ userId: req.user!.id }, { userId: recipient.id }]
        }
      },
      include: { members: true }
    })
    res.status(201).json({ conversation })
  })
)

messagesRoutes.post(
  '/conversations/group/all',
  asyncHandler(async (req, res) => {
    const existing = await prisma.conversation.findFirst({
      where: { institutionId: req.institutionId!, type: ConversationType.GROUP, title: 'Groupe général' }
    })
    if (existing) return res.json({ conversation: existing })

    const users = await prisma.user.findMany({
      where: { institutionId: req.institutionId!, isActive: true },
      select: { id: true }
    })
    const conversation = await prisma.conversation.create({
      data: {
        institutionId: req.institutionId!,
        type: ConversationType.GROUP,
        title: 'Groupe général',
        createdById: req.user!.id,
        members: { create: users.map((user) => ({ userId: user.id })) }
      }
    })
    res.status(201).json({ conversation })
  })
)

messagesRoutes.post(
  '/conversations/direction',
  validate(
    z.object({
      body: z.object({
        title: z.string().optional(),
        body: z.string().optional()
      }).optional()
    })
  ),
  asyncHandler(async (req, res) => {
    const staffUsers = await prisma.user.findMany({
      where: {
        institutionId: req.institutionId!,
        isActive: true,
        role: { in: [UserRole.DIRECTOR, UserRole.ADMINISTRATION, UserRole.SECRETARIAT] }
      },
      select: { id: true }
    })
    if (!staffUsers.length) throw notFound('Aucun membre de direction disponible')

    const title = req.body?.title?.trim() || 'Lien direct avec la direction'
    const memberIds = [...new Set([req.user!.id, ...staffUsers.map((user) => user.id)])]
    const conversation = await prisma.conversation.create({
      data: {
        institutionId: req.institutionId!,
        type: ConversationType.SUPPORT,
        title,
        createdById: req.user!.id,
        members: { create: memberIds.map((userId) => ({ userId })) },
        messages: req.body?.body?.trim()
          ? {
              create: {
                senderId: req.user!.id,
                body: req.body.body.trim()
              }
            }
          : undefined
      },
      include: {
        members: { include: { user: { select: { id: true, firstName: true, lastName: true, role: true, avatarUrl: true } } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 }
      }
    })
    res.status(201).json({ conversation })
  })
)

messagesRoutes.get(
  '/conversations/:id/messages',
  asyncHandler(async (req, res) => {
    const member = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId: req.params.id, userId: req.user!.id } }
    })
    if (!member) throw forbidden('Vous ne faites pas partie de cette conversation')
    const messages = await prisma.message.findMany({
      where: { conversationId: req.params.id },
      include: { sender: { select: { id: true, firstName: true, lastName: true, role: true, avatarUrl: true } } },
      orderBy: { createdAt: 'asc' }
    })
    res.json({ messages })
  })
)

messagesRoutes.post(
  '/conversations/:id/messages',
  validate(
    z.object({
      params: z.object({ id: z.string() }),
      body: z.object({
        body: z.string().min(1),
        attachmentUrl: z.string().url().optional()
      })
    })
  ),
  asyncHandler(async (req, res) => {
    const member = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId: req.params.id, userId: req.user!.id } }
    })
    if (!member) throw forbidden('Vous ne faites pas partie de cette conversation')
    const message = await prisma.message.create({
      data: {
        conversationId: req.params.id,
        senderId: req.user!.id,
        body: req.body.body,
        attachmentUrl: req.body.attachmentUrl
      }
    })
    await prisma.conversation.update({ where: { id: req.params.id }, data: { updatedAt: new Date() } })
    res.status(201).json({ message })
  })
)
