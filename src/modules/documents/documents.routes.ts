import fs from 'node:fs'
import archiver from 'archiver'
import { Router } from 'express'
import { DocumentFolderCategory, DocumentOwnerType, DocumentPermissionLevel, DocumentType, Prisma, UserRole } from '@prisma/client'
import { prisma } from '../../config/prisma'
import { asyncHandler } from '../../lib/async'
import { badRequest, notFound } from '../../lib/errors'
import { getParentScope } from '../../lib/parent-access'
import { writeAuditLog } from '../../lib/audit'
import { upload, resolveStoragePath, safeDownloadName, storageKeyFromPath } from '../../lib/storage'
import { authenticate } from '../../middlewares/auth'
import { requireRoles, requireTenantUser } from '../../middlewares/rbac'

export const documentsRoutes = Router()
documentsRoutes.use(authenticate, requireTenantUser)

const uploadRoles = [
  UserRole.DIRECTOR,
  UserRole.ADMINISTRATION,
  UserRole.SECRETARIAT,
  UserRole.ACCOUNTANT
] as const

const managerRoles = [
  UserRole.DIRECTOR,
  UserRole.ADMINISTRATION,
  UserRole.SECRETARIAT,
  UserRole.CENTRAL_ADMIN
] as const

const documentManagerRoles = new Set<UserRole>(managerRoles)

function isDocumentManager(role: UserRole) {
  return documentManagerRoles.has(role)
}

async function getOrCreateDefaultFolder(institutionId: string, userId?: string | null) {
  const existing = await prisma.documentFolder.findFirst({
    where: { institutionId, parentFolderId: null, name: 'Non classés' }
  })
  if (existing) return existing
  return prisma.documentFolder.create({
    data: {
      institutionId,
      name: 'Non classés',
      category: DocumentFolderCategory.OTHER,
      createdById: userId ?? null
    }
  })
}

async function assertFolderWritable(folderId: string, institutionId: string) {
  const folder = await prisma.documentFolder.findFirst({ where: { id: folderId, institutionId } })
  if (!folder) throw badRequest('Dossier document introuvable')
  return folder
}

async function documentAccessWhere(req: Express.Request): Promise<Prisma.DocumentWhereInput> {
  const institutionId = req.institutionId!
  const user = req.user!

  if (isDocumentManager(user.role)) return { institutionId }

  if (user.role === UserRole.PARENT) {
    const scope = await getParentScope(institutionId, user.id)
    if (!scope.parent) throw notFound('Profil parent introuvable')
    return {
      institutionId,
      OR: [
        { ownerType: DocumentOwnerType.STUDENT, ownerId: { in: scope.studentIds } },
        { ownerType: DocumentOwnerType.PARENT, ownerId: scope.parent.id },
        { ownerType: DocumentOwnerType.USER, ownerId: user.id },
        { permissions: { some: { userId: user.id, permission: { in: [DocumentPermissionLevel.READ, DocumentPermissionLevel.DOWNLOAD] } } } }
      ]
    }
  }

  if (user.role === UserRole.TEACHER) {
    const teacher = await prisma.teacher.findFirst({
      where: { institutionId, userId: user.id },
      select: { id: true, assignments: { select: { classroomId: true } } }
    })
    const classroomIds = [...new Set(teacher?.assignments.map((assignment) => assignment.classroomId) ?? [])]
    const students = classroomIds.length
      ? await prisma.student.findMany({
          where: { institutionId, classroomId: { in: classroomIds } },
          select: { id: true }
        })
      : []

    return {
      institutionId,
      OR: [
        ...(teacher ? [{ ownerType: DocumentOwnerType.TEACHER, ownerId: teacher.id }] : []),
        ...(students.length
          ? [{ ownerType: DocumentOwnerType.STUDENT, ownerId: { in: students.map((student) => student.id) } }]
          : []),
        { ownerType: DocumentOwnerType.USER, ownerId: user.id },
        { permissions: { some: { userId: user.id, permission: { in: [DocumentPermissionLevel.READ, DocumentPermissionLevel.DOWNLOAD] } } } }
      ]
    }
  }

  if (user.role === UserRole.STUDENT) {
    const student = await prisma.student.findFirst({
      where: { institutionId, userId: user.id },
      select: { id: true }
    })
    return {
      institutionId,
      OR: [
        ...(student ? [{ ownerType: DocumentOwnerType.STUDENT, ownerId: student.id }] : []),
        { ownerType: DocumentOwnerType.USER, ownerId: user.id },
        { permissions: { some: { userId: user.id, permission: { in: [DocumentPermissionLevel.READ, DocumentPermissionLevel.DOWNLOAD] } } } }
      ]
    }
  }

  if (user.role === UserRole.ACCOUNTANT) {
    return {
      institutionId,
      OR: [
        { ownerType: DocumentOwnerType.PAYMENT },
        { ownerType: DocumentOwnerType.SALE },
        { ownerType: DocumentOwnerType.USER, ownerId: user.id },
        { permissions: { some: { userId: user.id, permission: { in: [DocumentPermissionLevel.READ, DocumentPermissionLevel.DOWNLOAD] } } } }
      ]
    }
  }

  if (user.role === UserRole.STOCK_MANAGER) {
    return {
      institutionId,
      OR: [
        { ownerType: DocumentOwnerType.SALE },
        { ownerType: DocumentOwnerType.USER, ownerId: user.id },
        { permissions: { some: { userId: user.id, permission: { in: [DocumentPermissionLevel.READ, DocumentPermissionLevel.DOWNLOAD] } } } }
      ]
    }
  }

  return {
    institutionId,
    OR: [
      { ownerType: DocumentOwnerType.USER, ownerId: user.id },
      { permissions: { some: { userId: user.id, permission: { in: [DocumentPermissionLevel.READ, DocumentPermissionLevel.DOWNLOAD] } } } }
    ]
  }
}

async function assertDocumentOwnerBelongsToInstitution(ownerType: DocumentOwnerType, ownerId: string, institutionId: string) {
  let count = 0
  switch (ownerType) {
    case DocumentOwnerType.INSTITUTION:
      count = await prisma.institution.count({ where: { id: ownerId } })
      break
    case DocumentOwnerType.ESTABLISHMENT:
      count = await prisma.establishment.count({ where: { id: ownerId, institutionId } })
      break
    case DocumentOwnerType.STUDENT:
      count = await prisma.student.count({ where: { id: ownerId, institutionId } })
      break
    case DocumentOwnerType.TEACHER:
      count = await prisma.teacher.count({ where: { id: ownerId, institutionId } })
      break
    case DocumentOwnerType.PARENT:
      count = await prisma.parent.count({ where: { id: ownerId, institutionId } })
      break
    case DocumentOwnerType.USER:
      count = await prisma.user.count({ where: { id: ownerId, institutionId } })
      break
    case DocumentOwnerType.PAYMENT:
      count = await prisma.payment.count({ where: { id: ownerId, institutionId } })
      break
    case DocumentOwnerType.SALE:
      count = await prisma.sale.count({ where: { id: ownerId, institutionId } })
      break
    case DocumentOwnerType.MESSAGE:
      count = await prisma.message.count({ where: { id: ownerId, conversation: { institutionId } } })
      break
  }
  if (!count) throw badRequest("Le propriétaire du document n'appartient pas à cet établissement")
}

documentsRoutes.get(
  '/folders',
  asyncHandler(async (req, res) => {
    const folders = await prisma.documentFolder.findMany({
      where: { institutionId: req.institutionId! },
      include: { createdBy: { select: { id: true, firstName: true, lastName: true, role: true } }, _count: { select: { documents: true } } },
      orderBy: [{ category: 'asc' }, { name: 'asc' }]
    })
    res.json({ folders })
  })
)

documentsRoutes.post(
  '/folders',
  requireRoles(...uploadRoles),
  asyncHandler(async (req, res) => {
    const name = String(req.body.name ?? '').trim()
    if (!name) throw badRequest('Nom du dossier requis')
    const category = (req.body.category as DocumentFolderCategory | undefined) ?? DocumentFolderCategory.OTHER
    if (!Object.values(DocumentFolderCategory).includes(category)) throw badRequest('Catégorie dossier invalide')
    const parentFolderId = req.body.parentFolderId ? String(req.body.parentFolderId) : null
    if (parentFolderId) await assertFolderWritable(parentFolderId, req.institutionId!)
    const folder = await prisma.documentFolder.create({
      data: {
        institutionId: req.institutionId!,
        name,
        category,
        parentFolderId,
        createdById: req.user!.id
      }
    })
    await writeAuditLog({
      institutionId: req.institutionId,
      actorId: req.user!.id,
      action: 'DOCUMENT_FOLDER_CREATED',
      entity: 'DocumentFolder',
      entityId: folder.id,
      metadata: { name, category, idempotencyKey: req.get('Idempotency-Key') },
      req
    })
    res.status(201).json({ folder })
  })
)

documentsRoutes.patch(
  '/folders/:id',
  requireRoles(...managerRoles),
  asyncHandler(async (req, res) => {
    const existing = await prisma.documentFolder.findFirst({ where: { id: req.params.id, institutionId: req.institutionId! } })
    if (!existing) throw notFound('Dossier introuvable')
    const category = req.body.category as DocumentFolderCategory | undefined
    if (category && !Object.values(DocumentFolderCategory).includes(category)) throw badRequest('Catégorie dossier invalide')
    const folder = await prisma.documentFolder.update({
      where: { id: existing.id },
      data: {
        name: typeof req.body.name === 'string' && req.body.name.trim() ? req.body.name.trim() : undefined,
        category,
        parentFolderId: req.body.parentFolderId === undefined ? undefined : (req.body.parentFolderId ? String(req.body.parentFolderId) : null)
      }
    })
    await writeAuditLog({
      institutionId: req.institutionId,
      actorId: req.user!.id,
      action: 'DOCUMENT_FOLDER_UPDATED',
      entity: 'DocumentFolder',
      entityId: folder.id,
      metadata: { oldValue: existing, newValue: folder, idempotencyKey: req.get('Idempotency-Key') },
      req
    })
    res.json({ folder })
  })
)

documentsRoutes.delete(
  '/folders/:id',
  requireRoles(...managerRoles),
  asyncHandler(async (req, res) => {
    const folder = await prisma.documentFolder.findFirst({
      where: { id: req.params.id, institutionId: req.institutionId! },
      include: { _count: { select: { documents: true, children: true } } }
    })
    if (!folder) throw notFound('Dossier introuvable')
    if (folder._count.documents || folder._count.children) throw badRequest('Ce dossier contient encore des documents ou sous-dossiers')
    await prisma.documentFolder.delete({ where: { id: folder.id } })
    await writeAuditLog({
      institutionId: req.institutionId,
      actorId: req.user!.id,
      action: 'DOCUMENT_FOLDER_DELETED',
      entity: 'DocumentFolder',
      entityId: folder.id,
      metadata: { name: folder.name, idempotencyKey: req.get('Idempotency-Key') },
      req
    })
    res.json({ ok: true })
  })
)

documentsRoutes.get(
  '/',
  asyncHandler(async (req, res) => {
    const ownerType = req.query.ownerType as DocumentOwnerType | undefined
    const ownerId = req.query.ownerId as string | undefined
    const type = req.query.type as DocumentType | undefined
    const folderId = req.query.folderId as string | undefined
    const category = req.query.category as DocumentFolderCategory | undefined
    const search = typeof req.query.search === 'string' ? req.query.search : undefined
    if (ownerType && !Object.values(DocumentOwnerType).includes(ownerType)) throw badRequest('ownerType invalide')
    if (type && !Object.values(DocumentType).includes(type)) throw badRequest('type invalide')
    if (category && !Object.values(DocumentFolderCategory).includes(category)) throw badRequest('category invalide')

    const filters: Prisma.DocumentWhereInput[] = [await documentAccessWhere(req)]
    if (ownerType) filters.push({ ownerType })
    if (ownerId) filters.push({ ownerId })
    if (type) filters.push({ type })
    if (folderId) filters.push({ folderId })
    if (category) filters.push({ category })
    if (search) {
      filters.push({
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { fileKey: { contains: search, mode: 'insensitive' } }
        ]
      })
    }

    const documents = await prisma.document.findMany({
      where: { AND: filters },
      include: {
        folder: true,
        uploadedBy: { select: { id: true, firstName: true, lastName: true, role: true } },
        updatedBy: { select: { id: true, firstName: true, lastName: true, role: true } },
        permissions: true
      },
      orderBy: { createdAt: 'desc' }
    })
    res.json({ documents })
  })
)

documentsRoutes.post(
  '/',
  requireRoles(...uploadRoles),
  upload.array('files', 10),
  asyncHandler(async (req, res) => {
    const files = req.files as Express.Multer.File[]
    if (!files?.length) throw badRequest('Aucun fichier reçu')

    const ownerType = req.body.ownerType as DocumentOwnerType
    const ownerId = String(req.body.ownerId ?? '')
    const type = (req.body.type as DocumentType | undefined) ?? DocumentType.OTHER
    const category = (req.body.category as DocumentFolderCategory | undefined) ?? DocumentFolderCategory.OTHER
    if (!Object.values(DocumentOwnerType).includes(ownerType)) throw badRequest('ownerType invalide')
    if (!ownerId) throw badRequest('ownerId requis')
    if (!Object.values(DocumentType).includes(type)) throw badRequest('type invalide')
    if (!Object.values(DocumentFolderCategory).includes(category)) throw badRequest('category invalide')
    if (ownerType === DocumentOwnerType.INSTITUTION && ownerId !== req.institutionId) {
      throw badRequest("L'institution cible doit être l'établissement connecté")
    }
    await assertDocumentOwnerBelongsToInstitution(ownerType, ownerId, req.institutionId!)
    const folderId = req.body.folderId
      ? String(req.body.folderId)
      : (await getOrCreateDefaultFolder(req.institutionId!, req.user!.id)).id
    await assertFolderWritable(folderId, req.institutionId!)

    const documents = await Promise.all(
      files.map(async (file) => {
        const fileKey = storageKeyFromPath(file.path)
        const document = await prisma.document.create({
          data: {
            institutionId: req.institutionId!,
            folderId,
            ownerType,
            ownerId,
            type,
            category,
            title: req.body.title ?? file.originalname,
            fileUrl: '',
            fileKey,
            mimeType: file.mimetype,
            sizeBytes: file.size,
            uploadedById: req.user!.id
          }
        })
        return prisma.document.update({
          where: { id: document.id },
          data: { fileUrl: `/api/documents/${document.id}/download` }
        })
      })
    )

    await Promise.all(
      documents.map((document) =>
        writeAuditLog({
          institutionId: req.institutionId,
          actorId: req.user!.id,
          action: 'DOCUMENT_UPLOADED',
          entity: 'Document',
          entityId: document.id,
          metadata: { folderId, ownerType, ownerId, type, idempotencyKey: req.get('Idempotency-Key') },
          req
        })
      )
    )

    const photo = documents.find((document) => document.type === DocumentType.PHOTO)
    if (photo && ownerType === DocumentOwnerType.STUDENT) {
      await prisma.student.updateMany({
        where: { id: ownerId, institutionId: req.institutionId! },
        data: { photoUrl: photo.fileUrl }
      })
    }
    if (photo && ownerType === DocumentOwnerType.TEACHER) {
      await prisma.teacher.updateMany({
        where: { id: ownerId, institutionId: req.institutionId! },
        data: { photoUrl: photo.fileUrl }
      })
    }
    if (ownerType === DocumentOwnerType.TEACHER) {
      const idCard = documents.find((document) => document.type === DocumentType.ID_CARD)
      const cv = documents.find((document) => document.type === DocumentType.CV)
      const contract = documents.find((document) => document.type === DocumentType.CONTRACT)
      await prisma.teacher.updateMany({
        where: { id: ownerId, institutionId: req.institutionId! },
        data: {
          idDocumentUrl: idCard?.fileUrl,
          cvUrl: cv?.fileUrl,
          contractUrl: contract?.fileUrl
        }
      })
    }
    if (ownerType === DocumentOwnerType.INSTITUTION) {
      const logo = documents.find((document) => document.type === DocumentType.LOGO)
      const seal = documents.find((document) => document.type === DocumentType.SEAL)
      const signature = documents.find((document) => document.type === DocumentType.SIGNATURE)
      await prisma.institution.updateMany({
        where: { id: req.institutionId! },
        data: {
          logoUrl: logo?.fileUrl,
          sealUrl: seal?.fileUrl,
          signatureUrl: signature?.fileUrl
        }
      })
    }

    res.status(201).json({ documents })
  })
)

documentsRoutes.get(
  '/:id/permissions',
  requireRoles(...managerRoles),
  asyncHandler(async (req, res) => {
    const document = await prisma.document.findFirst({ where: { id: req.params.id, institutionId: req.institutionId! } })
    if (!document) throw notFound('Document introuvable')
    const permissions = await prisma.documentPermission.findMany({
      where: { documentId: document.id, institutionId: req.institutionId! },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, role: true, phone: true } },
        grantedBy: { select: { id: true, firstName: true, lastName: true, role: true } }
      },
      orderBy: { createdAt: 'desc' }
    })
    res.json({ permissions })
  })
)

documentsRoutes.post(
  '/:id/permissions',
  requireRoles(...managerRoles),
  asyncHandler(async (req, res) => {
    const document = await prisma.document.findFirst({ where: { id: req.params.id, institutionId: req.institutionId! } })
    if (!document) throw notFound('Document introuvable')
    const userId = String(req.body.userId ?? '')
    const permissions: unknown[] = Array.isArray(req.body.permissions) ? req.body.permissions : [req.body.permission]
    if (!userId) throw badRequest('Utilisateur requis')
    const user = await prisma.user.findFirst({ where: { id: userId, institutionId: req.institutionId!, isActive: true } })
    if (!user) throw badRequest("L'utilisateur n'appartient pas à cet établissement")
    const validPermissions = permissions.filter((permission): permission is DocumentPermissionLevel =>
      Object.values(DocumentPermissionLevel).includes(permission as DocumentPermissionLevel)
    )
    if (!validPermissions.length) throw badRequest('Permission requise')
    await prisma.$transaction(async (tx) => {
      for (const permission of validPermissions) {
        await tx.documentPermission.upsert({
          where: { documentId_userId_permission: { documentId: document.id, userId, permission } },
          update: { grantedById: req.user!.id },
          create: {
            institutionId: req.institutionId!,
            documentId: document.id,
            userId,
            permission,
            grantedById: req.user!.id
          }
        })
      }
    })
    await writeAuditLog({
      institutionId: req.institutionId,
      actorId: req.user!.id,
      action: 'DOCUMENT_PERMISSION_GRANTED',
      entity: 'Document',
      entityId: document.id,
      metadata: { userId, permissions: validPermissions, idempotencyKey: req.get('Idempotency-Key') },
      req
    })
    const next = await prisma.documentPermission.findMany({ where: { documentId: document.id, userId } })
    res.status(201).json({ permissions: next })
  })
)

documentsRoutes.delete(
  '/:id/permissions/:permissionId',
  requireRoles(...managerRoles),
  asyncHandler(async (req, res) => {
    const permission = await prisma.documentPermission.findFirst({
      where: { id: req.params.permissionId, documentId: req.params.id, institutionId: req.institutionId! }
    })
    if (!permission) throw notFound('Permission introuvable')
    await prisma.documentPermission.delete({ where: { id: permission.id } })
    await writeAuditLog({
      institutionId: req.institutionId,
      actorId: req.user!.id,
      action: 'DOCUMENT_PERMISSION_REVOKED',
      entity: 'Document',
      entityId: req.params.id,
      metadata: { permission, idempotencyKey: req.get('Idempotency-Key') },
      req
    })
    res.json({ ok: true })
  })
)

documentsRoutes.get(
  '/:id/download',
  asyncHandler(async (req, res) => {
    const accessWhere = await documentAccessWhere(req)
    const document = await prisma.document.findFirst({
      where: { id: req.params.id, AND: [accessWhere] }
    })
    if (!document) throw notFound('Document introuvable')
    const filePath = resolveStoragePath(document.fileKey)
    if (!fs.existsSync(filePath)) throw notFound('Fichier introuvable')
    await writeAuditLog({
      institutionId: req.institutionId,
      actorId: req.user!.id,
      action: 'DOCUMENT_DOWNLOADED',
      entity: 'Document',
      entityId: document.id,
      metadata: { title: document.title },
      req
    })
    res.setHeader('Content-Type', document.mimeType)
    // Allow cross-origin embedding (logos, seals, signatures displayed from Vercel)
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
    const isImage = document.mimeType.startsWith('image/')
    if (isImage) {
      res.setHeader('Content-Disposition', `inline; filename="${safeDownloadName(document.title)}"`)
      res.setHeader('Cache-Control', 'public, max-age=86400')
      res.sendFile(filePath)
    } else {
      res.download(filePath, safeDownloadName(document.title))
    }
  })
)

documentsRoutes.delete(
  '/:id',
  requireRoles(...managerRoles),
  asyncHandler(async (req, res) => {
    const document = await prisma.document.findFirst({
      where: { id: req.params.id, institutionId: req.institutionId! }
    })
    if (!document) throw notFound('Document introuvable')
    const filePath = resolveStoragePath(document.fileKey)
    await prisma.document.delete({ where: { id: document.id } })
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    await writeAuditLog({
      institutionId: req.institutionId,
      actorId: req.user!.id,
      action: 'DOCUMENT_DELETED',
      entity: 'Document',
      entityId: document.id,
      metadata: { title: document.title, folderId: document.folderId, idempotencyKey: req.get('Idempotency-Key') },
      req
    })
    res.json({ ok: true })
  })
)

documentsRoutes.get(
  '/bundle.zip',
  requireRoles(...managerRoles),
  asyncHandler(async (req, res) => {
    const ownerType = req.query.ownerType as DocumentOwnerType | undefined
    const ownerId = req.query.ownerId as string | undefined
    const documents = await prisma.document.findMany({
      where: { institutionId: req.institutionId!, ownerType, ownerId }
    })
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', 'attachment; filename="documents.zip"')
    const archive = archiver('zip')
    archive.pipe(res)
    for (const document of documents) {
      const filePath = resolveStoragePath(document.fileKey)
      if (fs.existsSync(filePath)) archive.file(filePath, { name: safeDownloadName(document.title) })
    }
    await archive.finalize()
  })
)
