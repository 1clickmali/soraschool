import path from 'node:path'
import { Router } from 'express'
import { asyncHandler } from '../../lib/async'
import { notFound } from '../../lib/errors'
import { getPlatformBranding, resolvePlatformAsset, toPublicPlatformBranding } from '../../lib/platform-branding'
import { safeDownloadName } from '../../lib/storage'

export const platformRoutes = Router()

platformRoutes.get(
  '/branding',
  asyncHandler(async (_req, res) => {
    const branding = await getPlatformBranding()
    res.json({ branding: toPublicPlatformBranding(branding) })
  })
)

platformRoutes.get(
  '/assets',
  asyncHandler(async (req, res) => {
    const fileKey = typeof req.query.key === 'string' ? req.query.key : ''
    const filePath = fileKey ? resolvePlatformAsset(fileKey) : null
    if (!filePath) throw notFound('Fichier introuvable')
    res.sendFile(filePath, {
      headers: {
        'Cache-Control': 'public, max-age=86400',
        'Content-Disposition': `inline; filename="${safeDownloadName(path.basename(filePath), 'asset')}"`
      }
    })
  })
)
