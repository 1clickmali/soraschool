import { prisma } from '../config/prisma'
import { logger } from './logger'
import { sendSms } from './sms-internal'

export type NotifChannel = 'IN_APP' | 'SMS' | 'PUSH' | 'WHATSAPP'

interface NotifPayload {
  institutionId: string
  userId?: string
  level?: 'INFO' | 'SUCCESS' | 'WARNING' | 'DANGER'
  channel?: NotifChannel
  title: string
  body?: string
  data?: Record<string, unknown>
  phone?: string
  smsMessage?: string
}

export async function sendNotification(payload: NotifPayload): Promise<void> {
  const { institutionId, userId, level = 'INFO', channel = 'IN_APP', title, body, data, phone, smsMessage } = payload

  try {
    await prisma.notification.create({
      data: {
        institutionId,
        userId,
        level,
        channel,
        title,
        body,
        data: data ? JSON.parse(JSON.stringify(data)) : undefined,
        sentAt: new Date()
      }
    })

    if ((channel === 'SMS' || channel === 'PUSH') && phone && smsMessage) {
      await sendSms(phone, smsMessage)
    }
  } catch (err) {
    logger.error({ err, institutionId, userId, title }, '[Notification] Erreur envoi')
  }
}

export async function notifyAbsence(opts: {
  institutionId: string
  studentName: string
  className: string
  date: string
  parentUserId?: string
  parentPhone?: string
  appName?: string
}) {
  const { institutionId, studentName, className, date, parentUserId, parentPhone, appName = 'SoraSchool' } = opts
  await sendNotification({
    institutionId,
    userId: parentUserId,
    level: 'WARNING',
    channel: parentPhone ? 'SMS' : 'IN_APP',
    title: `Absence — ${studentName}`,
    body: `${studentName} a été marqué(e) absent(e) le ${date} en ${className}.`,
    data: { studentName, className, date },
    phone: parentPhone,
    smsMessage: `${appName} - Absence de ${studentName} le ${date} (${className}). Connectez-vous pour justifier l'absence.`
  })
}

export async function notifyGrade(opts: {
  institutionId: string
  studentName: string
  subject: string
  score: number
  maxScore: number
  parentUserId?: string
  parentPhone?: string
  appName?: string
}) {
  const { institutionId, studentName, subject, score, maxScore, parentUserId, parentPhone, appName = 'SoraSchool' } = opts
  await sendNotification({
    institutionId,
    userId: parentUserId,
    level: 'INFO',
    channel: parentPhone ? 'SMS' : 'IN_APP',
    title: `Note — ${studentName}`,
    body: `${studentName} a obtenu ${score}/${maxScore} en ${subject}.`,
    data: { studentName, subject, score, maxScore },
    phone: parentPhone,
    smsMessage: `${appName} - ${studentName} : ${score}/${maxScore} en ${subject}.`
  })
}

export async function notifyPaymentReceived(opts: {
  institutionId: string
  studentName: string
  amount: number
  currency: string
  parentUserId?: string
  parentPhone?: string
  appName?: string
}) {
  const { institutionId, studentName, amount, currency, parentUserId, parentPhone, appName = 'SoraSchool' } = opts
  const formatted = new Intl.NumberFormat('fr-FR').format(amount)
  await sendNotification({
    institutionId,
    userId: parentUserId,
    level: 'SUCCESS',
    channel: parentPhone ? 'SMS' : 'IN_APP',
    title: `Paiement reçu — ${studentName}`,
    body: `Paiement de ${formatted} ${currency} enregistré pour ${studentName}.`,
    data: { studentName, amount, currency },
    phone: parentPhone,
    smsMessage: `${appName} - Paiement de ${formatted} ${currency} reçu pour ${studentName}.`
  })
}

export async function notifyDisciplineAlert(opts: {
  institutionId: string
  studentName: string
  score: number
  parentUserId?: string
  parentPhone?: string
  appName?: string
}) {
  const { institutionId, studentName, score, parentUserId, parentPhone, appName = 'SoraSchool' } = opts
  const level = score <= 10 ? 'DANGER' : score <= 30 ? 'DANGER' : 'WARNING'
  await sendNotification({
    institutionId,
    userId: parentUserId,
    level,
    channel: parentPhone ? 'SMS' : 'IN_APP',
    title: `Alerte comportement — ${studentName}`,
    body: `Score de discipline de ${studentName} : ${score}/100. Une intervention est recommandée.`,
    data: { studentName, score },
    phone: parentPhone,
    smsMessage: `${appName} - Alerte: Score de discipline de ${studentName} est à ${score}/100. Veuillez contacter l'établissement.`
  })
}
