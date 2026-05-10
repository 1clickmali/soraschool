import jwt from 'jsonwebtoken'
import { env } from '../config/env'
import { badRequest } from './errors'

export type SharedDocumentLinkPayload =
  | { type: 'INVOICE'; institutionId: string; invoiceId: string }
  | { type: 'RECEIPT'; institutionId: string; paymentId: string }
  | { type: 'REPORT_CARD'; institutionId: string; studentId: string; periodId: string }

export type SharedDocumentTokenPayload = SharedDocumentLinkPayload & { scope: 'PARENT_DOCUMENT' }

export function absoluteBackendUrl(path: string) {
  return new URL(path, env.BACKEND_URL).toString()
}

export function signSharedDocumentToken(payload: SharedDocumentLinkPayload) {
  return jwt.sign(
    { ...payload, scope: 'PARENT_DOCUMENT' },
    env.JWT_ACCESS_SECRET,
    { expiresIn: '14d' as jwt.SignOptions['expiresIn'] }
  )
}

export function sharedDocumentUrl(payload: SharedDocumentLinkPayload) {
  return absoluteBackendUrl(`/api/shared-documents/${signSharedDocumentToken(payload)}`)
}

export function verifySharedDocumentToken(token: string): SharedDocumentTokenPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET)
  if (!decoded || typeof decoded === 'string') throw badRequest('Lien document invalide')

  const payload = decoded as Partial<SharedDocumentTokenPayload>
  if (payload.scope !== 'PARENT_DOCUMENT' || !payload.type || !payload.institutionId) {
    throw badRequest('Lien document invalide')
  }

  if (payload.type === 'INVOICE' && payload.invoiceId) return payload as SharedDocumentTokenPayload
  if (payload.type === 'RECEIPT' && payload.paymentId) return payload as SharedDocumentTokenPayload
  if (payload.type === 'REPORT_CARD' && payload.studentId && payload.periodId) {
    return payload as SharedDocumentTokenPayload
  }

  throw badRequest('Lien document incomplet')
}
