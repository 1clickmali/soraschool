import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { InstitutionStatus, ThemePreference, UserRole } from '@prisma/client'
import { prisma } from '../../config/prisma'
import { env } from '../../config/env'
import { asyncHandler } from '../../lib/async'
import { badRequest, forbidden, unauthorized } from '../../lib/errors'
import {
  compareSecret,
  generateOtp,
  hashSecret,
  normalizePhone,
  phoneLookupVariants,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken
} from '../../lib/security'
import { authenticate } from '../../middlewares/auth'
import { validate } from '../../middlewares/validate'
import { logger } from '../../lib/logger'
import { getPlatformBranding } from '../../lib/platform-branding'
import { sendOtpSms } from '../../lib/sms'

export const authRoutes = Router()

const otpRequestLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Trop de demandes OTP. Réessayez dans quelques minutes.'
    }
  }
})

const otpVerifyLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Trop de tentatives OTP. Réessayez dans quelques minutes.'
    }
  }
})

const refreshLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Trop de tentatives de renouvellement de session.' } }
})

const requestOtpSchema = z.object({
  body: z.object({
    phone: z.string().min(6),
    schoolSlug: z.string().optional()
  })
})

const verifyOtpSchema = z.object({
  body: z.object({
    phone: z.string().min(6),
    code: z.string().length(6),
    schoolSlug: z.string().optional()
  })
})

const themePreferenceSchema = z.object({
  body: z.object({
    themePreference: z.nativeEnum(ThemePreference)
  })
})

function tokenPayload(user: {
  id: string
  role: UserRole
  institutionId: string | null
  establishmentId: string | null
}) {
  return {
    sub: user.id,
    role: user.role,
    institutionId: user.institutionId,
    establishmentId: user.establishmentId
  }
}

async function issueTokens(user: {
  id: string
  role: UserRole
  institutionId: string | null
  establishmentId: string | null
}) {
  const payload = tokenPayload(user)
  const accessToken = signAccessToken(payload)
  const refreshToken = signRefreshToken(payload)
  await prisma.user.update({
    where: { id: user.id },
    data: {
      refreshTokenHash: await hashSecret(refreshToken),
      lastLoginAt: new Date()
    }
  })
  return { accessToken, refreshToken }
}

authRoutes.post(
  '/request-otp',
  otpRequestLimiter,
  validate(requestOtpSchema),
  asyncHandler(async (req, res) => {
    const branding = await getPlatformBranding()
    const phone = normalizePhone(req.body.phone)
    const phoneVariants = phoneLookupVariants(req.body.phone)
    const schoolSlug = req.body.schoolSlug as string | undefined

    let institutionId: string | null = null
    if (schoolSlug) {
      const institution = await prisma.institution.findUnique({
        where: { slug: schoolSlug },
        select: { id: true, status: true }
      })
      if (!institution) throw badRequest('Établissement introuvable')
      if (institution.status === InstitutionStatus.SUSPENDED || institution.status === InstitutionStatus.DELETED) {
        throw forbidden("L’accès de cet établissement est suspendu. Veuillez contacter la direction ou SoraSchool.")
      }
      institutionId = institution.id

      const existingUser = await prisma.user.findFirst({ where: { institutionId, phone: { in: phoneVariants }, isActive: true } })
      const allowedPhone = await prisma.allowedPhone.findFirst({
        where: { institutionId, phone: { in: phoneVariants } }
      })
      const parentProfile = await prisma.parent.findFirst({
        where: { institutionId, phone: { in: phoneVariants } },
        select: { id: true }
      })

      if (!existingUser && !allowedPhone && !parentProfile) {
        throw forbidden("Ce numéro n'est pas autorisé à accéder à cet établissement. Veuillez contacter l'administration.")
      }
    } else {
      const superAdmin = await prisma.user.findFirst({
        where: { phone: { in: phoneVariants }, role: UserRole.SUPER_ADMIN, isActive: true }
      })
      if (!superAdmin) throw forbidden(`Ce numéro n’est pas autorisé comme Super Admin ${branding.appName}. Support : ${branding.supportEmail} / ${branding.supportPhone}.`)
    }

    const code = generateOtp()
    await prisma.otpCode.deleteMany({
      where: { phone, institutionId, expiresAt: { gt: new Date() } }
    })
    await prisma.otpCode.create({
      data: {
        institutionId,
        phone,
        codeHash: await hashSecret(code),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000)
      }
    })

    const smsSent = await sendOtpSms(phone, code, branding.appName)

    // Always log OTP when MOCK_SMS is active (regardless of NODE_ENV or smsSent)
    if (env.MOCK_SMS || env.OTP_LOG_CODES) {
      logger.info({ phone, schoolSlug, code }, `[MOCK SMS] OTP ${code} pour ${phone}`)
    }

    const debugPayload = env.MOCK_SMS ? { mock: true, debugCode: code } : {}

    res.json({ ok: true, message: smsSent ? 'Code OTP envoyé par SMS' : 'Code OTP envoyé', ...debugPayload })
  })
)

authRoutes.post(
  '/verify-otp',
  otpVerifyLimiter,
  validate(verifyOtpSchema),
  asyncHandler(async (req, res) => {
    const phone = normalizePhone(req.body.phone)
    const phoneVariants = phoneLookupVariants(req.body.phone)
    const schoolSlug = req.body.schoolSlug as string | undefined
    const institution = schoolSlug
      ? await prisma.institution.findUnique({ where: { slug: schoolSlug } })
      : null
    if (schoolSlug && !institution) throw badRequest('Établissement introuvable')
    if (institution && (institution.status === InstitutionStatus.SUSPENDED || institution.status === InstitutionStatus.DELETED)) {
      throw forbidden("L’accès de cet établissement est suspendu. Veuillez contacter la direction ou SoraSchool.")
    }
    const institutionId = institution?.id ?? null

    const otp = await prisma.otpCode.findFirst({
      where: {
        phone,
        institutionId,
        consumedAt: null,
        expiresAt: { gt: new Date() }
      },
      orderBy: { createdAt: 'desc' }
    })

    if (!otp) throw unauthorized('Code OTP invalide ou expiré')
    if (otp.attempts >= 5) {
      await prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } })
      throw unauthorized('Trop de tentatives. Demandez un nouveau code OTP.')
    }

    const valid = await compareSecret(req.body.code, otp.codeHash)
    if (!valid) {
      const nextAttempts = otp.attempts + 1
      await prisma.otpCode.update({
        where: { id: otp.id },
        data: {
          attempts: { increment: 1 },
          consumedAt: nextAttempts >= 5 ? new Date() : undefined
        }
      })
      throw unauthorized(nextAttempts >= 5 ? 'Trop de tentatives. Demandez un nouveau code OTP.' : 'Code OTP invalide')
    }

    let user = await prisma.user.findFirst({
      where: schoolSlug
        ? { institutionId, phone: { in: phoneVariants }, isActive: true }
        : { phone: { in: phoneVariants }, role: UserRole.SUPER_ADMIN, isActive: true }
    })

    if (!user && institutionId) {
      const allowed = await prisma.allowedPhone.findFirst({
        where: { institutionId, phone: { in: phoneVariants } }
      })
      const parentProfile = await prisma.parent.findFirst({
        where: { institutionId, phone: { in: phoneVariants } }
      })
      if (!allowed && !parentProfile) throw forbidden("Ce numéro n'est pas autorisé à accéder à cet établissement.")

      user = await prisma.user.create({
        data: {
          institutionId,
          role: allowed?.role ?? UserRole.PARENT,
          firstName: allowed?.firstName ?? parentProfile?.firstName ?? 'Parent',
          lastName: allowed?.lastName ?? parentProfile?.lastName ?? 'SoraSchool',
          phone,
          email: allowed?.email ?? parentProfile?.email,
          isActive: true
        }
      })
      if (parentProfile && !parentProfile.userId) {
        await prisma.parent.update({ where: { id: parentProfile.id }, data: { userId: user.id } })
      }
      if (allowed) {
        await prisma.allowedPhone.update({
          where: { id: allowed.id },
          data: { usedAt: new Date() }
        })
      }
    }

    if (!user) throw unauthorized('Compte introuvable')
    await prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } })
    const tokens = await issueTokens(user)

    res.json({
      user: {
        id: user.id,
        role: user.role,
        institutionId: user.institutionId,
        establishmentId: user.establishmentId,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        themePreference: user.themePreference
      },
      ...tokens
    })
  })
)

authRoutes.post(
  '/refresh',
  refreshLimiter,
  asyncHandler(async (req, res) => {
    const refreshToken = String(req.body.refreshToken ?? '')
    if (!refreshToken) throw unauthorized('Refresh token requis')
    const payload = verifyRefreshToken(refreshToken)
    const user = await prisma.user.findUnique({ where: { id: payload.sub } })
    if (!user?.refreshTokenHash) throw unauthorized('Session expirée')
    const valid = await compareSecret(refreshToken, user.refreshTokenHash)
    if (!valid) throw unauthorized('Refresh token invalide')
    res.json(await issueTokens(user))
  })
)

authRoutes.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        institutionId: true,
        establishmentId: true,
        role: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        avatarUrl: true,
        preferredLanguage: true,
        themePreference: true
      }
    })
    res.json({ user })
  })
)

authRoutes.patch(
  '/theme',
  authenticate,
  validate(themePreferenceSchema),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { themePreference: req.body.themePreference },
      select: { id: true, themePreference: true }
    })

    await prisma.auditLog.create({
      data: {
        institutionId: req.user!.institutionId,
        actorId: req.user!.id,
        action: 'THEME_PREFERENCE_UPDATED',
        entity: 'User',
        entityId: req.user!.id,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        metadata: { themePreference: user.themePreference }
      }
    })

    res.json({ user })
  })
)

authRoutes.post(
  '/logout',
  authenticate,
  asyncHandler(async (req, res) => {
    await prisma.user.update({ where: { id: req.user!.id }, data: { refreshTokenHash: null } })
    res.json({ ok: true })
  })
)
