import fs from 'node:fs'
import archiver from 'archiver'
import { Router } from 'express'
import { DocumentOwnerType, DocumentType, Prisma, UserRole } from '@prisma/client'
import { prisma } from '../../config/prisma'
import { asyncHandler } from '../../lib/async'
import { badRequest, notFound } from '../../lib/errors'
import { getParentScope } from '../../lib/parent-access'
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
        { ownerType: DocumentOwnerType.USER, ownerId: user.id }
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
        { ownerType: DocumentOwnerType.USER, ownerId: user.id }
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
        { ownerType: DocumentOwnerType.USER, ownerId: user.id }
      ]
    }
  }

  if (user.role === UserRole.ACCOUNTANT) {
    return {
      institutionId,
      OR: [
        { ownerType: DocumentOwnerType.PAYMENT },
        { ownerType: DocumentOwnerType.SALE },
        { ownerType: DocumentOwnerType.USER, ownerId: user.id }
      ]
    }
  }

  if (user.role === UserRole.STOCK_MANAGER) {
    return {
      institutionId,
      OR: [{ ownerType: DocumentOwnerType.SALE }, { ownerType: DocumentOwnerType.USER, ownerId: user.id }]
    }
  }

  return { institutionId, ownerType: DocumentOwnerType.USER, ownerId: user.id }
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
  '/',
  asyncHandler(async (req, res) => {
    const ownerType = req.query.ownerType as DocumentOwnerType | undefined
    const ownerId = req.query.ownerId as string | undefined
    const type = req.query.type as DocumentType | undefined
    const search = typeof req.query.search === 'string' ? req.query.search : undefined
    if (ownerType && !Object.values(DocumentOwnerType).includes(ownerType)) throw badRequest('ownerType invalide')
    if (type && !Object.values(DocumentType).includes(type)) throw badRequest('type invalide')

    const filters: Prisma.DocumentWhereInput[] = [await documentAccessWhere(req)]
    if (ownerType) filters.push({ ownerType })
    if (ownerId) filters.push({ ownerId })
    if (type) filters.push({ type })
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
    if (!Object.values(DocumentOwnerType).includes(ownerType)) throw badRequest('ownerType invalide')
    if (!ownerId) throw badRequest('ownerId requis')
    if (!Object.values(DocumentType).includes(type)) throw badRequest('type invalide')
    if (ownerType === DocumentOwnerType.INSTITUTION && ownerId !== req.institutionId) {
      throw badRequest("L'institution cible doit être l'établissement connecté")
    }
    await assertDocumentOwnerBelongsToInstitution(ownerType, ownerId, req.institutionId!)

    const documents = await Promise.all(
      files.map(async (file) => {
        const fileKey = storageKeyFromPath(file.path)
        const document = await prisma.document.create({
          data: {
            institutionId: req.institutionId!,
            ownerType,
            ownerId,
            type,
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
  '/:id/download',
  asyncHandler(async (req, res) => {
    const accessWhere = await documentAccessWhere(req)
    const document = await prisma.document.findFirst({
      where: { id: req.params.id, AND: [accessWhere] }
    })
    if (!document) throw notFound('Document introuvable')
    const filePath = resolveStoragePath(document.fileKey)
    if (!fs.existsSync(filePath)) throw notFound('Fichier introuvable')
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
