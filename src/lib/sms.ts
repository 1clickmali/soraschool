import { env } from '../config/env'
import { logger } from './logger'

async function sendSms(to: string, message: string): Promise<boolean> {
  if (env.MOCK_SMS || !env.AT_API_KEY || !env.AT_USERNAME) {
    logger.info({ to, message }, '[MOCK SMS]')
    return true
  }
  const endpoint =
    env.NODE_ENV === 'production'
      ? 'https://api.africastalking.com/version1/messaging'
      : 'https://api.sandbox.africastalking.com/version1/messaging'
  const body = new URLSearchParams({ username: env.AT_USERNAME, to, message })
  if (env.AT_SENDER_ID) body.set('from', env.AT_SENDER_ID)
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        apiKey: env.AT_API_KEY
      },
      body: body.toString()
    })
    const data = (await res.json()) as {
      SMSMessageData?: { Recipients?: Array<{ status: string }> }
    }
    return data?.SMSMessageData?.Recipients?.[0]?.status === 'Success'
  } catch (err) {
    logger.error({ to, err }, '[SMS] Erreur réseau')
    return false
  }
}

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
