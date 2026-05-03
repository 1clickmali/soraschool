import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import type { UserRole } from '@prisma/client'
import { env } from '../config/env'

export type JwtPayload = {
  sub: string
  role: UserRole
  institutionId: string | null
  establishmentId: string | null
}

export function normalizePhone(phone: string) {
  const compact = phone.trim().replace(/[\s().-]/g, '')
  if (!compact) return compact

  const withInternationalPrefix = compact.startsWith('00') ? `+${compact.slice(2)}` : compact
  const digits = withInternationalPrefix.replace(/\D/g, '')
  const isIvorian = withInternationalPrefix.startsWith('+225') || digits.startsWith('225')

  if (!isIvorian) {
    return withInternationalPrefix.startsWith('+') ? `+${digits}` : digits
  }

  let local = digits.startsWith('225') ? digits.slice(3) : digits
  while (local.length > 10 && local.startsWith('0') && local[2] === '0') {
    local = `${local.slice(0, 2)}${local.slice(3)}`
  }

  return `+225${local}`
}

export function phoneLookupVariants(phone: string) {
  const normalized = normalizePhone(phone)
  const variants = new Set<string>([normalized])
  const compact = phone.trim().replace(/[\s().-]/g, '')
  if (compact) variants.add(compact.startsWith('00') ? `+${compact.slice(2)}` : compact)

  if (normalized.startsWith('+225')) {
    const local = normalized.slice(4)
    variants.add(local)
    variants.add(`225${local}`)
    if (local.length === 10 && local.startsWith('0')) {
      variants.add(`+225${local.slice(0, 2)}0${local.slice(2)}`)
    }
  }

  return [...variants]
}

export async function hashSecret(value: string) {
  return bcrypt.hash(value, 12)
}

export async function compareSecret(value: string, hash: string) {
  return bcrypt.compare(value, hash)
}

export function signAccessToken(payload: JwtPayload) {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_TTL as jwt.SignOptions['expiresIn'] })
}

export function signRefreshToken(payload: JwtPayload) {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_TTL as jwt.SignOptions['expiresIn'] })
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload
}

export function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export function generateMatricule(prefix: string, count: number) {
  return `${prefix}-${String(count + 1).padStart(5, '0')}`
}
