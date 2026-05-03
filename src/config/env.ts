import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  CORS_ORIGIN: z.string().default('http://localhost:5174'),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),
  UPLOAD_ROOT: z.string().default('./storage'),
  PUBLIC_API_URL: z.string().url().default('http://localhost:4000'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  BACKEND_URL: z.string().url().default('http://localhost:4000'),
  STORAGE_URL: z.string().url().optional(),
  APP_NAME: z.string().default('SoraSchool'),
  SUPPORT_EMAIL: z.string().email().default('contact@soratech.ci'),
  SUPPORT_PHONE: z.string().default('0704928068'),
  SUPPORT_ADDRESS: z.string().optional(),
  SUPPORT_WEBSITE: z.string().url().optional(),
  MOCK_SMS: z.coerce.boolean().default(true),
  MAX_UPLOAD_MB: z.coerce.number().default(10),
  // Africa's Talking SMS provider (optional - active si AT_API_KEY défini)
  AT_API_KEY: z.string().optional(),
  AT_USERNAME: z.string().optional(),
  AT_SENDER_ID: z.string().optional(),
  // Logue les codes OTP dans les logs serveur (utile pour Railway logs en production pendant les tests)
  OTP_LOG_CODES: z.coerce.boolean().default(false)
})

export const env = envSchema.parse(process.env)

export const corsOrigins = env.CORS_ORIGIN.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

export function isCorsOriginAllowed(origin?: string) {
  if (!origin) return true;
  if (corsOrigins.includes('*')) return env.NODE_ENV !== 'production';
  if (corsOrigins.includes(origin)) return true;

  try {
    const { hostname, port } = new URL(origin);

    // En production : uniquement les origines explicitement listées dans CORS_ORIGIN
    if (env.NODE_ENV === 'production') return false;

    // En dev/staging : autoriser les domaines Vercel/Railway pour les previews
    if (hostname.endsWith('.vercel.app')) return true;
    if (hostname.endsWith('.railway.app')) return true;

    const isPrivateLan =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);

    return isPrivateLan && ['3000', '3001', '5173', '5174'].includes(port);
  } catch {
    return false;
  }
}
