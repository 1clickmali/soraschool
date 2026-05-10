import { Router } from 'express'
import { asyncHandler } from '../../lib/async'
import { badRequest } from '../../lib/errors'
import { verifySharedDocumentToken } from '../../lib/shared-document-links'
import { writeAuditLog } from '../../lib/audit'
import { renderInvoicePdf, renderPaymentReceiptPdf, renderReportCardPdf } from '../pdf/pdf.service'

export const sharedDocumentsRoutes = Router()

sharedDocumentsRoutes.get(
  '/:token',
  asyncHandler(async (req, res) => {
    const payload = verifySharedDocumentToken(req.params.token)

    let buffer: Buffer
    let filename: string
    let entityId: string

    if (payload.type === 'INVOICE') {
      buffer = await renderInvoicePdf(payload.institutionId, payload.invoiceId, String(req.query.lang ?? 'FR'))
      filename = `facture-${payload.invoiceId}.pdf`
      entityId = payload.invoiceId
    } else if (payload.type === 'RECEIPT') {
      buffer = await renderPaymentReceiptPdf(payload.institutionId, payload.paymentId, String(req.query.lang ?? 'FR'))
      filename = `recu-${payload.paymentId}.pdf`
      entityId = payload.paymentId
    } else if (payload.type === 'REPORT_CARD') {
      buffer = await renderReportCardPdf(payload.institutionId, payload.studentId, payload.periodId, String(req.query.lang ?? 'FR'))
      filename = `bulletin-${payload.studentId}-${payload.periodId}.pdf`
      entityId = `${payload.studentId}:${payload.periodId}`
    } else {
      throw badRequest('Type de document non supporté')
    }

    await writeAuditLog({
      institutionId: payload.institutionId,
      action: 'SHARED_DOCUMENT_OPENED',
      entity: payload.type,
      entityId,
      req,
      metadata: { tokenScope: payload.scope }
    })

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`)
    res.setHeader('Cache-Control', 'private, max-age=300')
    res.send(buffer)
  })
)
