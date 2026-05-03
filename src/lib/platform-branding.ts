import fs from 'node:fs'
import type { PlatformBranding } from '@prisma/client'
import { prisma } from '../config/prisma'
import { env } from '../config/env'
import { resolveStoragePath } from './storage'

export const PLATFORM_BRANDING_ID = 'default'

export const DEFAULT_PLATFORM_BRANDING = {
  id: PLATFORM_BRANDING_ID,
  appName: env.APP_NAME || 'SoraSchool',
  slogan: 'La plateforme scolaire intelligente',
  logoUrl: null as string | null,
  faviconUrl: null as string | null,
  supportEmail: env.SUPPORT_EMAIL || 'contact@soratech.ci',
  supportPhone: env.SUPPORT_PHONE || '0704928068',
  supportAddress: env.SUPPORT_ADDRESS ?? null,
  website: env.SUPPORT_WEBSITE ?? null,
  primaryColor: '#0F6BFF',
  secondaryColor: '#07111F',
  accentColor: '#F5B941'
}

export type PublicPlatformBranding = Pick<
  PlatformBranding,
  | 'appName'
  | 'slogan'
  | 'logoUrl'
  | 'faviconUrl'
  | 'supportEmail'
  | 'supportPhone'
  | 'supportAddress'
  | 'website'
  | 'primaryColor'
  | 'secondaryColor'
  | 'accentColor'
>

export async function ensurePlatformBranding() {
  return prisma.platformBranding.upsert({
    where: { id: PLATFORM_BRANDING_ID },
    update: {
      appName: DEFAULT_PLATFORM_BRANDING.appName,
      supportEmail: DEFAULT_PLATFORM_BRANDING.supportEmail,
      supportPhone: DEFAULT_PLATFORM_BRANDING.supportPhone
    },
    create: DEFAULT_PLATFORM_BRANDING
  })
}

export async function getPlatformBranding(): Promise<PlatformBranding> {
  const branding = await prisma.platformBranding.findUnique({ where: { id: PLATFORM_BRANDING_ID } })
  if (branding) return branding
  return ensurePlatformBranding()
}

export function toPublicPlatformBranding(branding: PlatformBranding): PublicPlatformBranding {
  return {
    appName: branding.appName,
    slogan: branding.slogan,
    logoUrl: branding.logoUrl,
    faviconUrl: branding.faviconUrl,
    supportEmail: branding.supportEmail,
    supportPhone: branding.supportPhone,
    supportAddress: branding.supportAddress,
    website: branding.website,
    primaryColor: branding.primaryColor,
    secondaryColor: branding.secondaryColor,
    accentColor: branding.accentColor
  }
}

export function platformAssetUrl(fileKey: string) {
  return `/api/platform/assets?key=${encodeURIComponent(fileKey)}`
}

export function resolvePlatformAsset(fileKey: string) {
  try {
    const filePath = resolveStoragePath(fileKey)
    return fs.existsSync(filePath) ? filePath : null
  } catch {
    return null
  }
}
