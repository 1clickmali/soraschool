import { Router } from 'express'
import { z } from 'zod'
import { ConversationType, UserRole } from '@prisma/client'
import { prisma } from '../../config/prisma'
import { asyncHandler } from '../../lib/async'
import { forbidden, notFound } from '../../lib/errors'
import { getParentScope } from '../../lib/parent-access'
import { normalizePhone } from '../../lib/security'
import { authenticate } from '../../middlewares/auth'
import { requireRoles, requireTenantUser } from '../../middlewares/rbac'
import { validate } from '../../middlewares/validate'

export const parentsRoutes = Router()
parentsRoutes.use(authenticate, requireTenantUser)

parentsRoutes.get(
  '/',
  requireRoles(UserRole.DIRECTOR, UserRole.ADMINISTRATION, UserRole.SECRETARIAT),
  asyncHandler(async (req, res) => {
    const parents = await prisma.parent.findMany({
      where: { institutionId: req.institutionId! },
      include: { students: { include: { student: true } } },
      orderBy: { lastName: 'asc' }
    })
    res.json({ parents })
  })
)

parentsRoutes.post(
  '/',
  requireRoles(UserRole.DIRECTOR, UserRole.ADMINISTRATION, UserRole.SECRETARIAT),
  validate(
    z.object({
      body: z.object({
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        phone: z.string().min(6),
        email: z.string().email().optional(),
        profession: z.string().optional(),
        address: z.string().optional(),
        studentId: z.string().optional(),
        relationship: z.string().optional(),
        isPrimary: z.boolean().default(false)
      })
    })
  ),
  asyncHandler(async (req, res) => {
    const phone = normalizePhone(req.body.phone)
    const parent = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          institutionId: req.institutionId!,
          role: UserRole.PARENT,
          firstName: req.body.firstName,
          lastName: req.body.lastName,
          phone,
          email: req.body.email
        }
      })
      await tx.allowedPhone.upsert({
        where: { institutionId_phone: { institutionId: req.institutionId!, phone } },
        update: { role: UserRole.PARENT, firstName: req.body.firstName, lastName: req.body.lastName, email: req.body.email },
        create: {
          institutionId: req.institutionId!,
          phone,
          role: UserRole.PARENT,
          firstName: req.body.firstName,
          lastName: req.body.lastName,
          email: req.body.email,
          createdById: req.user!.id
        }
      })
      const created = await tx.parent.create({
        data: {
          institutionId: req.institutionId!,
          userId: user.id,
          firstName: req.body.firstName,
          lastName: req.body.lastName,
          phone,
          email: req.body.email,
          profession: req.body.profession,
          address: req.body.address
        }
      })
      if (req.body.studentId) {
        await tx.studentParent.create({
          data: {
            institutionId: req.institutionId!,
            parentId: created.id,
            studentId: req.body.studentId,
            relationship: req.body.relationship ?? 'Tuteur',
            isPrimary: req.body.isPrimary
          }
        })
      }
      return created
    })
    res.status(201).json({ parent })
  })
)

parentsRoutes.get(
  '/dashboard',
  requireRoles(UserRole.PARENT),
  asyncHandler(async (req, res) => {
    const scope = await getParentScope(req.institutionId!, req.user!.id)
    if (!scope.parent) throw notFound('Profil parent introuvable')

    const parent = await prisma.parent.findFirst({
      where: { id: scope.parent.id, institutionId: req.institutionId! },
      include: {
        students: {
          include: {
            student: {
              include: {
                classroom: { include: { gradeLevel: true, academicYear: true } },
                grades: {
                  include: { subject: true, period: true, teacher: { select: { firstName: true, lastName: true } } },
                  orderBy: { createdAt: 'desc' }
                },
                attendances: {
                  include: {
                    session: { include: { classroom: true } },
                    justification: { select: { id: true, status: true, reason: true } }
                  },
                  orderBy: { createdAt: 'desc' },
                  take: 30
                },
                discipline: true,
                invoices: { include: { payments: { orderBy: { createdAt: 'desc' } } }, orderBy: { createdAt: 'desc' } }
              }
            }
          }
        }
      }
    })
    if (!parent) throw notFound('Profil parent introuvable')

    const [documents, reports] = await Promise.all([
      prisma.document.findMany({
        where: {
          institutionId: req.institutionId!,
          OR: [
            { ownerType: 'STUDENT', ownerId: { in: scope.studentIds } },
            { ownerType: 'PARENT', ownerId: parent.id }
          ]
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.conversation.findMany({
        where: {
          institutionId: req.institutionId!,
          type: ConversationType.SUPPORT,
          createdById: req.user!.id
        },
        include: {
          messages: { orderBy: { createdAt: 'asc' }, take: 3 },
          members: { include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } } }
        },
        orderBy: { updatedAt: 'desc' }
      })
    ])

    res.json({ parent, documents, reports })
  })
)

parentsRoutes.get(
  '/reports',
  requireRoles(UserRole.DIRECTOR, UserRole.ADMINISTRATION, UserRole.SECRETARIAT, UserRole.TEACHER, UserRole.PARENT),
  asyncHandler(async (req, res) => {
    const where = req.user!.role === UserRole.PARENT
      ? { institutionId: req.institutionId!, type: ConversationType.SUPPORT, createdById: req.user!.id }
      : { institutionId: req.institutionId!, type: ConversationType.SUPPORT }

    const reports = await prisma.conversation.findMany({
      where,
      include: {
        members: { include: { user: { select: { id: true, firstName: true, lastName: true, role: true, phone: true } } } },
        messages: {
          include: { sender: { select: { id: true, firstName: true, lastName: true, role: true } } },
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { updatedAt: 'desc' }
    })
    res.json({ reports })
  })
)

parentsRoutes.post(
  '/reports',
  requireRoles(UserRole.PARENT),
  validate(
    z.object({
      body: z.object({
        type: z.enum(['MALADIE', 'ABSENCE', 'PLAINTE', 'URGENCE']),
        childId: z.string().optional(),
        message: z.string().min(3),
        attachmentUrl: z.string().url().optional()
      })
    })
  ),
  asyncHandler(async (req, res) => {
    const scope = await getParentScope(req.institutionId!, req.user!.id)
    if (!scope.parent) throw notFound('Profil parent introuvable')
    if (req.body.childId && !scope.studentIds.includes(req.body.childId)) {
      throw forbidden("Vous ne pouvez signaler que pour l'un de vos enfants")
    }

    const [child, staffUsers] = await Promise.all([
      req.body.childId
        ? prisma.student.findFirst({
            where: { id: req.body.childId, institutionId: req.institutionId! },
            include: { classroom: true }
          })
        : Promise.resolve(null),
      prisma.user.findMany({
        where: {
          institutionId: req.institutionId!,
          isActive: true,
          role: { in: [UserRole.DIRECTOR, UserRole.ADMINISTRATION, UserRole.SECRETARIAT, UserRole.TEACHER] }
        },
        select: { id: true }
      })
    ])

    const titleParts = [
      `Plainte parent - ${req.body.type}`,
      child ? `${child.firstName} ${child.lastName}` : null,
      child?.classroom?.name
    ].filter(Boolean)

    const memberIds = [...new Set([req.user!.id, ...staffUsers.map((user) => user.id)])]
    const conversation = await prisma.conversation.create({
      data: {
        institutionId: req.institutionId!,
        type: ConversationType.SUPPORT,
        title: titleParts.join(' | '),
        createdById: req.user!.id,
        members: { create: memberIds.map((userId) => ({ userId })) },
        messages: {
          create: {
            senderId: req.user!.id,
            body: [
              child ? `Élève concerné : ${child.firstName} ${child.lastName}${child.classroom ? ` (${child.classroom.name})` : ''}` : null,
              `Type : ${req.body.type}`,
              req.body.message
            ].filter(Boolean).join('\n\n'),
            attachmentUrl: req.body.attachmentUrl
          }
        }
      },
      include: {
        messages: true,
        members: { include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } } }
      }
    })
    res.status(201).json({ report: conversation })
  })
)
