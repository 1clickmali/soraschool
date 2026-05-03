import type { NextFunction, Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import { logger } from './logger'

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code = 'API_ERROR',
    public details?: unknown
  ) {
    super(message)
  }
}

export function notFound(message = 'Ressource introuvable') {
  return new ApiError(404, message, 'NOT_FOUND')
}

export function forbidden(message = 'Action non autorisée') {
  return new ApiError(403, message, 'FORBIDDEN')
}

export function unauthorized(message = 'Authentification requise') {
  return new ApiError(401, message, 'UNAUTHORIZED')
}

export function badRequest(message = 'Requête invalide', details?: unknown) {
  return new ApiError(400, message, 'BAD_REQUEST', details)
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details
      }
    })
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const message = err.code === 'P2002' ? 'Cette donnée existe déjà' : 'Erreur base de données'
    return res.status(409).json({
      error: {
        code: err.code,
        message,
        meta: err.meta
      }
    })
  }

  logger.error({ err, path: req.path }, 'Unhandled error')
  return res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Erreur interne du serveur'
    }
  })
}
