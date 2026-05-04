import { logger } from './logger'
import { sendSms } from './sms-internal'

export { sendSms } from './sms-internal'

export async function sendReminderSms(to: string, invoiceNumber: string, amount: number, currency: string, appName: string): Promise<boolean> {
  const formatted = new Intl.NumberFormat('fr-FR').format(amount)
  const message = `${appName} - Rappel : Votre facture ${invoiceNumber} d'un montant de ${formatted} ${currency} est en attente de paiement. Contactez-nous pour régulariser votre abonnement.`
  return sendSms(to, message)
}

export async function sendOtpSms(to: string, code: string, appName: string): Promise<boolean> {
  const message = `${appName} - Code OTP : ${code}. Valable 10 minutes. Ne le partagez pas.`
  const sent = await sendSms(to, message)
  if (sent) logger.info({ to }, '[SMS] OTP envoyé')
  return sent
}
