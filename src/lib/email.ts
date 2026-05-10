import nodemailer from 'nodemailer'
import { logger } from './logger'

let _transporter: nodemailer.Transporter | null = null

function getTransporter() {
  if (_transporter) return _transporter
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT ?? 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const secure = process.env.SMTP_SECURE === 'true'

  if (!host || !user || !pass) {
    return null
  }

  _transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } })
  return _transporter
}

export async function sendEmail(opts: {
  to: string
  subject: string
  html: string
  text?: string
  from?: string
}): Promise<boolean> {
  const transporter = getTransporter()
  if (!transporter) {
    logger.warn({ to: opts.to, subject: opts.subject }, '[Email] SMTP non configuré — email ignoré')
    return false
  }
  const fromName = process.env.APP_NAME ?? 'SoraSchool'
  const fromAddr = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? 'noreply@soraschool.ci'
  try {
    await transporter.sendMail({
      from: opts.from ?? `"${fromName}" <${fromAddr}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text
    })
    return true
  } catch (err) {
    logger.error({ err, to: opts.to, subject: opts.subject }, '[Email] Erreur envoi')
    return false
  }
}

export function emailPaymentReceipt(opts: {
  to: string
  studentName: string
  amount: number
  currency: string
  receiptNumber: string
  institutionName: string
  receiptUrl: string
}) {
  const formatted = new Intl.NumberFormat('fr-FR').format(opts.amount)
  return sendEmail({
    to: opts.to,
    subject: `Reçu de paiement ${opts.receiptNumber} — ${opts.institutionName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
        <h2 style="color:#064E3B">${opts.institutionName}</h2>
        <p>Bonjour,</p>
        <p>Nous confirmons la réception du paiement suivant :</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0">
          <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Élève</td><td style="padding:8px;border:1px solid #ddd">${opts.studentName}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Montant</td><td style="padding:8px;border:1px solid #ddd">${formatted} ${opts.currency}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">N° Reçu</td><td style="padding:8px;border:1px solid #ddd">${opts.receiptNumber}</td></tr>
        </table>
        <p><a href="${opts.receiptUrl}" style="background:#064E3B;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;display:inline-block">Télécharger le reçu PDF</a></p>
        <p style="color:#777;font-size:12px">Ce message est généré automatiquement par SoraSchool.</p>
      </div>
    `,
    text: `Paiement confirmé : ${formatted} ${opts.currency} pour ${opts.studentName}. N° Reçu : ${opts.receiptNumber}. Télécharger : ${opts.receiptUrl}`
  })
}

export function emailPasswordReset(opts: {
  to: string
  firstName: string
  otp: string
  appName: string
  expiresMinutes?: number
}) {
  return sendEmail({
    to: opts.to,
    subject: `Code de réinitialisation — ${opts.appName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
        <h2 style="color:#064E3B">${opts.appName}</h2>
        <p>Bonjour ${opts.firstName},</p>
        <p>Voici votre code de réinitialisation de mot de passe :</p>
        <div style="font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center;padding:20px;background:#f0fdf4;border-radius:8px;margin:16px 0;color:#064E3B">${opts.otp}</div>
        <p>Ce code expire dans <strong>${opts.expiresMinutes ?? 10} minutes</strong>.</p>
        <p style="color:#777">Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
      </div>
    `,
    text: `Code de réinitialisation : ${opts.otp}. Expire dans ${opts.expiresMinutes ?? 10} min.`
  })
}

export function emailWelcome(opts: {
  to: string
  firstName: string
  institutionName: string
  appName: string
  loginUrl: string
}) {
  return sendEmail({
    to: opts.to,
    subject: `Bienvenue sur ${opts.appName} — ${opts.institutionName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
        <h2 style="color:#064E3B">${opts.institutionName}</h2>
        <p>Bonjour ${opts.firstName},</p>
        <p>Votre compte a été créé sur <strong>${opts.appName}</strong>.</p>
        <p><a href="${opts.loginUrl}" style="background:#064E3B;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;display:inline-block">Se connecter</a></p>
        <p style="color:#777;font-size:12px">Ce message est généré automatiquement par SoraSchool.</p>
      </div>
    `,
    text: `Bienvenue ${opts.firstName} sur ${opts.appName}. Connectez-vous : ${opts.loginUrl}`
  })
}

export function emailGradeAlert(opts: {
  to: string
  parentName: string
  studentName: string
  subject: string
  score: number
  maxScore: number
  className: string
  appName: string
}) {
  const pct = Math.round((opts.score / opts.maxScore) * 100)
  const color = pct >= 60 ? '#064E3B' : pct >= 40 ? '#C89B3C' : '#dc2626'
  return sendEmail({
    to: opts.to,
    subject: `Note de ${opts.studentName} en ${opts.subject} — ${opts.appName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
        <h2 style="color:#064E3B">${opts.appName}</h2>
        <p>Bonjour ${opts.parentName},</p>
        <p>${opts.studentName} (${opts.className}) a obtenu :</p>
        <div style="font-size:28px;font-weight:bold;text-align:center;padding:16px;background:#f9fafb;border-radius:8px;margin:16px 0;color:${color}">${opts.score}/${opts.maxScore} en ${opts.subject}</div>
        <p style="color:#777;font-size:12px">Connectez-vous pour voir le bulletin complet.</p>
      </div>
    `,
    text: `${opts.studentName} : ${opts.score}/${opts.maxScore} en ${opts.subject}.`
  })
}
