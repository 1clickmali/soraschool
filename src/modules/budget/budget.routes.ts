import PDFDocument from 'pdfkit'
import ExcelJS from 'exceljs'
import { Router } from 'express'
import { z } from 'zod'
import { BudgetCategory, BudgetRequestStatus, BudgetUrgency, NotificationLevel, Prisma, UserRole } from '@prisma/client'
import { prisma } from '../../config/prisma'
import { asyncHandler } from '../../lib/async'
import { badRequest, forbidden, notFound } from '../../lib/errors'
import { writeAuditLog } from '../../lib/audit'
import { authenticate } from '../../middlewares/auth'
import { requireRoles, requireTenantUser } from '../../middlewares/rbac'
import { validate } from '../../middlewares/validate'

export const budgetRoutes = Router()
budgetRoutes.use(authenticate, requireTenantUser)

const budgetRoles = [UserRole.DIRECTOR, UserRole.ACCOUNTANT, UserRole.ADMINISTRATION] as const
const directorOnly = [UserRole.DIRECTOR] as const

const createBudgetSchema = z.object({
  body: z.object({
    title: z.string().min(2),
    category: z.nativeEnum(BudgetCategory).default(BudgetCategory.OTHER),
    amountRequested: z.number().int().positive(),
    description: z.string().optional(),
    urgency: z.nativeEnum(BudgetUrgency).default(BudgetUrgency.NORMAL),
    desiredDate: z.coerce.date().optional(),
    attachmentUrl: z.string().optional(),
    status: z.nativeEnum(BudgetRequestStatus).optional()
  })
})

const reviewBudgetSchema = z.object({
  body: z.object({
    decision: z.enum(['VALIDATED', 'REFUSED']),
    amountApproved: z.number().int().positive().optional(),
    directorComment: z.string().optional()
  })
})

const payBudgetSchema = z.object({
  body: z.object({
    amountPaid: z.number().int().positive(),
    note: z.string().optional()
  })
})

function displayName(user?: { firstName?: string | null; lastName?: string | null; phone?: string | null; role?: string | null } | null) {
  return user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.phone || user.role || 'Utilisateur' : 'Utilisateur'
}

function budgetInclude() {
  return {
    requestedBy: { select: { id: true, firstName: true, lastName: true, role: true } },
    approvedBy: { select: { id: true, firstName: true, lastName: true, role: true } },
    rejectedBy: { select: { id: true, firstName: true, lastName: true, role: true } },
    paidBy: { select: { id: true, firstName: true, lastName: true, role: true } }
  } as const
}

async function notifyDirectors(institutionId: string, title: string, body: string, data?: Record<string, unknown>) {
  const directors = await prisma.user.findMany({
    where: { institutionId, role: { in: [UserRole.DIRECTOR, UserRole.CENTRAL_ADMIN] }, isActive: true },
    select: { id: true }
  })
  if (!directors.length) return
  await prisma.notification.createMany({
    data: directors.map((director) => ({
      institutionId,
      userId: director.id,
      level: NotificationLevel.INFO,
      title,
      body,
      data: data as Prisma.InputJsonValue | undefined
    }))
  })
}

budgetRoutes.get(
  '/',
  requireRoles(...budgetRoles),
  asyncHandler(async (req, res) => {
    const status = req.query.status ? String(req.query.status) as BudgetRequestStatus : undefined
    const category = req.query.category ? String(req.query.category) as BudgetCategory : undefined
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : ''
    const requests = await prisma.budgetRequest.findMany({
      where: {
        institutionId: req.institutionId!,
        status,
        category,
        OR: search
          ? [
              { title: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } }
            ]
          : undefined
      },
      include: budgetInclude(),
      orderBy: { createdAt: 'desc' },
      take: 500
    })

    const summary = requests.reduce(
      (acc, request) => {
        acc.totalRequested += request.amountRequested
        acc.totalApproved += request.amountApproved ?? 0
        acc.totalPaid += request.amountPaid
        if (request.status === BudgetRequestStatus.PENDING_VALIDATION) acc.pending += 1
        if (request.status === BudgetRequestStatus.VALIDATED) acc.validated += 1
        if (request.status === BudgetRequestStatus.REFUSED) acc.refused += 1
        return acc
      },
      { totalRequested: 0, totalApproved: 0, totalPaid: 0, pending: 0, validated: 0, refused: 0 }
    )

    res.json({ requests, summary })
  })
)

budgetRoutes.post(
  '/',
  requireRoles(...budgetRoles),
  validate(createBudgetSchema),
  asyncHandler(async (req, res) => {
    const isDirector = req.user!.role === UserRole.DIRECTOR
    const status = isDirector
      ? (req.body.status === BudgetRequestStatus.DRAFT ? BudgetRequestStatus.DRAFT : BudgetRequestStatus.VALIDATED)
      : BudgetRequestStatus.PENDING_VALIDATION

    const request = await prisma.budgetRequest.create({
      data: {
        institutionId: req.institutionId!,
        title: req.body.title.trim(),
        category: req.body.category,
        amountRequested: req.body.amountRequested,
        amountApproved: status === BudgetRequestStatus.VALIDATED ? req.body.amountRequested : null,
        description: req.body.description?.trim() || null,
        urgency: req.body.urgency,
        desiredDate: req.body.desiredDate,
        attachmentUrl: req.body.attachmentUrl?.trim() || null,
        status,
        requestedById: req.user!.id,
        approvedById: status === BudgetRequestStatus.VALIDATED ? req.user!.id : null,
        approvedAt: status === BudgetRequestStatus.VALIDATED ? new Date() : null
      },
      include: budgetInclude()
    })

    await writeAuditLog({
      institutionId: req.institutionId,
      actorId: req.user!.id,
      action: 'BUDGET_REQUEST_CREATED',
      entity: 'BudgetRequest',
      entityId: request.id,
      metadata: { status, amountRequested: request.amountRequested, idempotencyKey: req.get('Idempotency-Key') },
      req
    })
    if (!isDirector) {
      await notifyDirectors(
        req.institutionId!,
        'Nouvelle demande budget',
        `${displayName(req.user)} a créé une demande de budget à valider.`,
        { budgetRequestId: request.id }
      )
    }

    res.status(201).json({ request })
  })
)

budgetRoutes.patch(
  '/:id/review',
  requireRoles(...directorOnly),
  validate(reviewBudgetSchema),
  asyncHandler(async (req, res) => {
    const existing = await prisma.budgetRequest.findFirst({ where: { id: req.params.id, institutionId: req.institutionId! } })
    if (!existing) throw notFound('Demande budget introuvable')
    if (existing.status === BudgetRequestStatus.PAID || existing.status === BudgetRequestStatus.CANCELED) {
      throw badRequest('Cette demande ne peut plus être validée ou refusée')
    }

    const decision = req.body.decision as 'VALIDATED' | 'REFUSED'
    const request = await prisma.budgetRequest.update({
      where: { id: existing.id },
      data: decision === 'VALIDATED'
        ? {
            status: BudgetRequestStatus.VALIDATED,
            amountApproved: req.body.amountApproved ?? existing.amountRequested,
            approvedById: req.user!.id,
            approvedAt: new Date(),
            rejectedById: null,
            rejectedAt: null,
            directorComment: req.body.directorComment?.trim() || null
          }
        : {
            status: BudgetRequestStatus.REFUSED,
            rejectedById: req.user!.id,
            rejectedAt: new Date(),
            directorComment: req.body.directorComment?.trim() || null
          },
      include: budgetInclude()
    })

    await writeAuditLog({
      institutionId: req.institutionId,
      actorId: req.user!.id,
      action: decision === 'VALIDATED' ? 'BUDGET_REQUEST_VALIDATED' : 'BUDGET_REQUEST_REFUSED',
      entity: 'BudgetRequest',
      entityId: request.id,
      metadata: { previousStatus: existing.status, nextStatus: request.status, idempotencyKey: req.get('Idempotency-Key') },
      req
    })

    res.json({ request })
  })
)

budgetRoutes.patch(
  '/:id/pay',
  requireRoles(UserRole.DIRECTOR, UserRole.ACCOUNTANT),
  validate(payBudgetSchema),
  asyncHandler(async (req, res) => {
    const existing = await prisma.budgetRequest.findFirst({ where: { id: req.params.id, institutionId: req.institutionId! } })
    if (!existing) throw notFound('Demande budget introuvable')
    if (existing.status !== BudgetRequestStatus.VALIDATED && existing.status !== BudgetRequestStatus.PAID) {
      throw forbidden('Le Directeur doit valider la demande avant tout décaissement')
    }
    const approved = existing.amountApproved ?? existing.amountRequested
    const nextPaid = Math.min(approved, existing.amountPaid + req.body.amountPaid)
    const request = await prisma.budgetRequest.update({
      where: { id: existing.id },
      data: {
        amountPaid: nextPaid,
        status: nextPaid >= approved ? BudgetRequestStatus.PAID : BudgetRequestStatus.VALIDATED,
        paidById: req.user!.id,
        paidAt: new Date()
      },
      include: budgetInclude()
    })
    await writeAuditLog({
      institutionId: req.institutionId,
      actorId: req.user!.id,
      action: 'BUDGET_REQUEST_PAID',
      entity: 'BudgetRequest',
      entityId: request.id,
      metadata: { amountPaid: req.body.amountPaid, nextPaid, note: req.body.note, idempotencyKey: req.get('Idempotency-Key') },
      req
    })
    res.json({ request })
  })
)

budgetRoutes.get(
  '/export/csv',
  requireRoles(...budgetRoles),
  asyncHandler(async (req, res) => {
    const requests = await prisma.budgetRequest.findMany({ where: { institutionId: req.institutionId! }, include: budgetInclude(), orderBy: { createdAt: 'desc' } })
    const rows = [
      ['Titre', 'Catégorie', 'Statut', 'Urgence', 'Demandé', 'Validé', 'Payé', 'Créé par', 'Validé par', 'Date'].join(';'),
      ...requests.map((item) => [
        item.title,
        item.category,
        item.status,
        item.urgency,
        item.amountRequested,
        item.amountApproved ?? '',
        item.amountPaid,
        displayName(item.requestedBy),
        displayName(item.approvedBy),
        item.createdAt.toISOString()
      ].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(';'))
    ]
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="budget.csv"')
    res.send(`\uFEFF${rows.join('\n')}`)
  })
)

budgetRoutes.get(
  '/export/xlsx',
  requireRoles(...budgetRoles),
  asyncHandler(async (req, res) => {
    const requests = await prisma.budgetRequest.findMany({ where: { institutionId: req.institutionId! }, include: budgetInclude(), orderBy: { createdAt: 'desc' } })
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'SoraSchool'
    const sheet = workbook.addWorksheet('Budget')
    sheet.columns = [
      { header: 'Titre', key: 'title', width: 28 },
      { header: 'Catégorie', key: 'category', width: 18 },
      { header: 'Statut', key: 'status', width: 20 },
      { header: 'Urgence', key: 'urgency', width: 14 },
      { header: 'Montant demandé', key: 'amountRequested', width: 18 },
      { header: 'Montant validé', key: 'amountApproved', width: 18 },
      { header: 'Montant payé', key: 'amountPaid', width: 16 },
      { header: 'Créé par', key: 'requestedBy', width: 24 },
      { header: 'Validé par', key: 'approvedBy', width: 24 },
      { header: 'Date', key: 'createdAt', width: 22 }
    ]
    requests.forEach((item) => sheet.addRow({
      title: item.title,
      category: item.category,
      status: item.status,
      urgency: item.urgency,
      amountRequested: item.amountRequested,
      amountApproved: item.amountApproved ?? 0,
      amountPaid: item.amountPaid,
      requestedBy: displayName(item.requestedBy),
      approvedBy: displayName(item.approvedBy),
      createdAt: item.createdAt
    }))
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF064E3B' } }
    sheet.autoFilter = { from: 'A1', to: 'J1' }
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename="budget.xlsx"')
    await workbook.xlsx.write(res)
    res.end()
  })
)

budgetRoutes.get(
  '/export/pdf',
  requireRoles(...budgetRoles),
  asyncHandler(async (req, res) => {
    const institution = await prisma.institution.findUnique({ where: { id: req.institutionId! } })
    const requests = await prisma.budgetRequest.findMany({ where: { institutionId: req.institutionId! }, include: budgetInclude(), orderBy: { createdAt: 'desc' }, take: 80 })
    const doc = new PDFDocument({ margin: 42, size: 'A4' })
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'inline; filename="budget.pdf"')
    doc.pipe(res)
    doc.fontSize(18).fillColor('#064E3B').text('Rapport budget', { align: 'center' })
    doc.moveDown(0.4)
    doc.fontSize(11).fillColor('#111827').text(institution?.name ?? 'Établissement', { align: 'center' })
    doc.fontSize(9).fillColor('#6B7280').text(`Généré le ${new Date().toLocaleString('fr-FR')} par SoraSchool`, { align: 'center' })
    doc.moveDown()
    requests.forEach((item) => {
      if (doc.y > 740) doc.addPage()
      doc.roundedRect(42, doc.y, 510, 58, 8).strokeColor('#E5E7EB').stroke()
      const y = doc.y + 10
      doc.fontSize(11).fillColor('#111827').text(item.title, 54, y, { width: 260 })
      doc.fontSize(9).fillColor('#6B7280').text(`${item.category} · ${item.status} · ${item.urgency}`, 54, y + 18)
      doc.fontSize(10).fillColor('#064E3B').text(`${item.amountRequested.toLocaleString('fr-FR')} XOF`, 350, y)
      doc.fontSize(8).fillColor('#6B7280').text(`Créé par : ${displayName(item.requestedBy)}`, 350, y + 18, { width: 170 })
      doc.moveDown(3.7)
    })
    doc.end()
  })
)
