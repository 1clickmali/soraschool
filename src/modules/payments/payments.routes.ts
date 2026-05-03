import { Router } from 'express'
import { z } from 'zod'
import { InvoiceStatus, PaymentProvider, PaymentStatus, UserRole } from '@prisma/client'
import { prisma } from '../../config/prisma'
import { asyncHandler } from '../../lib/async'
import { getScopedEstablishmentId } from '../../lib/access-scope'
import { badRequest, forbidden, notFound } from '../../lib/errors'
import { getParentScope } from '../../lib/parent-access'
import { authenticate } from '../../middlewares/auth'
import { requireRoles, requireTenantUser } from '../../middlewares/rbac'
import { validate } from '../../middlewares/validate'
import { renderInvoicePdf, renderPaymentReceiptPdf } from '../pdf/pdf.service'

export const paymentsRoutes = Router()
paymentsRoutes.use(authenticate, requireTenantUser)

function mapPaymentProvider(value?: string): PaymentProvider {
  switch (value) {
    case 'WAVE':
    case 'ORANGE_MONEY':
    case 'MTN_MONEY':
    case 'MOOV_MONEY':
    case 'BANK_TRANSFER':
    case 'CARD':
    case 'CASH':
      return value
    case 'MOBILE_MONEY':
      return PaymentProvider.WAVE
    default:
      return PaymentProvider.CASH
  }
}

paymentsRoutes.get(
  '/invoices',
  asyncHandler(async (req, res) => {
    const parentScope = req.user!.role === UserRole.PARENT
      ? await getParentScope(req.institutionId!, req.user!.id)
      : null
    if (parentScope && !parentScope.parent) throw notFound('Profil parent introuvable')
    const establishmentId = getScopedEstablishmentId(req)

    const invoices = await prisma.invoice.findMany({
      where: {
        institutionId: req.institutionId!,
        student: parentScope
          ? { id: { in: parentScope.studentIds } }
          : req.query.classroomId
            ? { classroomId: String(req.query.classroomId), establishmentId }
            : establishmentId
              ? { establishmentId }
              : undefined,
        status: req.query.status ? String(req.query.status) as never : undefined,
        OR: req.query.search
          ? [
              { number: { contains: String(req.query.search), mode: 'insensitive' } },
              { title: { contains: String(req.query.search), mode: 'insensitive' } },
              { student: { firstName: { contains: String(req.query.search), mode: 'insensitive' } } },
              { student: { lastName: { contains: String(req.query.search), mode: 'insensitive' } } },
              { student: { matricule: { contains: String(req.query.search), mode: 'insensitive' } } }
            ]
          : undefined
      },
      include: { student: { include: { classroom: true } }, payments: true },
      orderBy: { createdAt: 'desc' }
    })
    res.json({ invoices })
  })
)

paymentsRoutes.post(
  '/invoices',
  requireRoles(UserRole.CENTRAL_ADMIN, UserRole.DIRECTOR, UserRole.ADMINISTRATION, UserRole.ACCOUNTANT, UserRole.SECRETARIAT),
  validate(
    z.object({
      body: z.object({
        studentId: z.string(),
        title: z.string().min(2).optional(),
        totalAmount: z.number().int().positive().optional(),
        amount: z.number().int().positive().optional(),
        type: z.string().optional(),
        description: z.string().optional(),
        dueDate: z.coerce.date().optional()
      })
    })
  ),
  asyncHandler(async (req, res) => {
    const totalAmount = req.body.totalAmount ?? req.body.amount
    if (!totalAmount) throw badRequest('Le montant de la facture est requis')
    const student = await prisma.student.findFirst({
      where: { id: req.body.studentId, institutionId: req.institutionId!, establishmentId: getScopedEstablishmentId(req) },
      select: { id: true }
    })
    if (!student) throw badRequest('Élève introuvable pour votre périmètre')
    const count = await prisma.invoice.count({ where: { institutionId: req.institutionId! } })
    const invoice = await prisma.invoice.create({
      data: {
        institutionId: req.institutionId!,
        number: `INV-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`,
        studentId: req.body.studentId,
        title: req.body.title ?? req.body.description ?? req.body.type ?? 'Frais scolaires',
        totalAmount,
        dueDate: req.body.dueDate
      }
    })
    res.status(201).json({
      invoice,
      pdfs: {
        invoice: `/api/payments/invoices/${invoice.id}/pdf`
      }
    })
  })
)

paymentsRoutes.get(
  '/invoices/:id/pdf',
  asyncHandler(async (req, res) => {
    if (req.user!.role === UserRole.PARENT) {
      const invoice = await prisma.invoice.findFirst({
        where: { id: req.params.id, institutionId: req.institutionId! },
        select: { studentId: true }
      })
      if (!invoice) throw notFound('Facture introuvable')
      const scope = await getParentScope(req.institutionId!, req.user!.id)
      if (!scope.studentIds.includes(invoice.studentId)) throw forbidden('Facture non autorisée')
    }
    const buffer = await renderInvoicePdf(req.institutionId!, req.params.id, String(req.query.lang ?? 'FR'))
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="facture-${req.params.id}.pdf"`)
    res.send(buffer)
  })
)

paymentsRoutes.post(
  '/',
  requireRoles(UserRole.CENTRAL_ADMIN, UserRole.DIRECTOR, UserRole.ADMINISTRATION, UserRole.ACCOUNTANT, UserRole.SECRETARIAT),
  validate(
    z.object({
      body: z.object({
        invoiceId: z.string().optional(),
        studentId: z.string().optional(),
        parentId: z.string().optional(),
        amount: z.number().int().positive(),
        provider: z.nativeEnum(PaymentProvider).optional(),
        method: z.string().optional(),
        payerName: z.string().optional(),
        note: z.string().optional(),
        transactionRef: z.string().optional()
      })
    })
  ),
  asyncHandler(async (req, res) => {
    const count = await prisma.payment.count({ where: { institutionId: req.institutionId! } })
    const receiptNumber = `REC-${new Date().getFullYear()}-${String(count + 1).padStart(6, '0')}`
    const payment = await prisma.$transaction(async (tx) => {
      let invoice: { id: string; studentId: string; paidAmount: number; totalAmount: number } | null = null
      if (req.body.invoiceId) {
        invoice = await tx.invoice.findFirst({
          where: {
            id: req.body.invoiceId,
            institutionId: req.institutionId!,
            student: getScopedEstablishmentId(req) ? { establishmentId: getScopedEstablishmentId(req) } : undefined
          },
          select: { id: true, studentId: true, paidAmount: true, totalAmount: true }
        })
        if (!invoice) throw badRequest('Facture introuvable')
      }
      if (!invoice && req.body.studentId) {
        const student = await tx.student.findFirst({
          where: { id: req.body.studentId, institutionId: req.institutionId!, establishmentId: getScopedEstablishmentId(req) },
          select: { id: true }
        })
        if (!student) throw badRequest('Élève introuvable pour votre périmètre')
      }
      const created = await tx.payment.create({
        data: {
          institutionId: req.institutionId!,
          invoiceId: req.body.invoiceId,
          studentId: req.body.studentId ?? invoice?.studentId,
          parentId: req.body.parentId,
          amount: req.body.amount,
          provider: req.body.provider ?? mapPaymentProvider(req.body.method),
          status: PaymentStatus.PAID,
          transactionRef: req.body.transactionRef ?? req.body.payerName,
          receiptNumber,
          receiptUrl: '/pending',
          paidAt: new Date()
        }
      })
      const paymentWithReceipt = await tx.payment.update({
        where: { id: created.id },
        data: { receiptUrl: `/api/payments/${created.id}/receipt` }
      })
      if (invoice) {
        const paidAmount = invoice.paidAmount + req.body.amount
        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            paidAmount,
            status: paidAmount >= invoice.totalAmount ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID
          }
        })
      }
      return paymentWithReceipt
    })
    res.status(201).json({
      payment,
      pdfs: {
        receipt: `/api/payments/${payment.id}/receipt`,
        invoice: payment.invoiceId ? `/api/payments/invoices/${payment.invoiceId}/pdf` : undefined
      }
    })
  })
)

paymentsRoutes.get(
  '/:id/receipt',
  asyncHandler(async (req, res) => {
    if (req.user!.role === UserRole.PARENT) {
      const payment = await prisma.payment.findFirst({
        where: { id: req.params.id, institutionId: req.institutionId! },
        include: { invoice: { select: { studentId: true } } }
      })
      if (!payment) throw notFound('Paiement introuvable')
      const scope = await getParentScope(req.institutionId!, req.user!.id)
      const studentId = payment.studentId ?? payment.invoice?.studentId
      if (!studentId || !scope.studentIds.includes(studentId)) throw forbidden('Reçu non autorisé')
    }
    const buffer = await renderPaymentReceiptPdf(req.institutionId!, req.params.id, String(req.query.lang ?? 'FR'))
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="recu-${req.params.id}.pdf"`)
    res.send(buffer)
  })
)
