import compression from 'compression'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import pinoHttp from 'pino-http'
import swaggerUi from 'swagger-ui-express'
import { env, isCorsOriginAllowed } from './config/env'
import { swaggerSpec } from './config/swagger'
import { logger } from './lib/logger'
import { ApiError, errorHandler } from './lib/errors'
import { authRoutes } from './modules/auth/auth.routes'
import { superAdminRoutes } from './modules/super-admin/super-admin.routes'
import { centralAdminRoutes } from './modules/central-admin/central-admin.routes'
import { institutionsRoutes } from './modules/institutions/institutions.routes'
import { academicsRoutes } from './modules/academics/academics.routes'
import { studentsRoutes } from './modules/students/students.routes'
import { teachersRoutes } from './modules/teachers/teachers.routes'
import { parentsRoutes } from './modules/parents/parents.routes'
import { gradesRoutes } from './modules/grades/grades.routes'
import { attendanceRoutes } from './modules/attendance/attendance.routes'
import { disciplineRoutes } from './modules/discipline/discipline.routes'
import { notificationsRoutes } from './modules/notifications/notifications.routes'
import { teacherBadgesRoutes } from './modules/teachers/teacher-badges.routes'
import { paymentsRoutes } from './modules/payments/payments.routes'
import { shopRoutes } from './modules/shop/shop.routes'
import { documentsRoutes } from './modules/documents/documents.routes'
import { messagesRoutes } from './modules/messages/messages.routes'
import { dashboardRoutes } from './modules/dashboard/dashboard.routes'
import { scheduleRoutes } from './modules/schedule/schedule.routes'
import { homeworksRoutes } from './modules/homeworks/homeworks.routes'
import { calendarRoutes } from './modules/calendar/calendar.routes'
import { reportsRoutes } from './modules/reports/reports.routes'
import { platformRoutes } from './modules/platform/platform.routes'
import { getPlatformBranding } from './lib/platform-branding'
import { enforceSubscription } from './middlewares/subscription'

export function createApp() {
  const app = express()

  app.set('trust proxy', 1)
  app.use(helmet())
  app.use(
    cors({
      origin(origin, cb) {
        if (isCorsOriginAllowed(origin)) return cb(null, true)
        return cb(new Error(`CORS refused for ${origin}`))
      },
      credentials: true
    })
  )
  app.use(compression())
  app.use(cookieParser())
  app.use(express.json({ limit: '2mb' }))
  app.use(express.urlencoded({ extended: true }))
  app.use(pinoHttp({ logger }))
  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      max: 180,
      standardHeaders: true,
      legacyHeaders: false
    })
  )

  app.get('/', async (_req, res) => {
    try {
      const branding = await getPlatformBranding()
      res.json({
        ok: true,
        name: `${branding.appName} API`,
        message: `Backend ${branding.appName} opérationnel. Utilisez /docs/ pour Swagger ou /health pour vérifier le serveur.`,
        links: { health: '/health', auth: '/api/auth' }
      })
    } catch {
      res.json({ ok: true })
    }
  })

  app.get('/api', async (_req, res) => {
    try {
      const branding = await getPlatformBranding()
      res.json({ ok: true, name: `${branding.appName} API`, version: '0.1.0', health: '/health' })
    } catch {
      res.json({ ok: true, version: '0.1.0', health: '/health' })
    }
  })

  app.get('/health', async (_req, res) => {
    try {
      const branding = await getPlatformBranding()
      res.json({ ok: true, name: `${branding.appName} API`, uptime: process.uptime() })
    } catch {
      res.json({ ok: true, uptime: process.uptime() })
    }
  })

  app.use('/api/platform', platformRoutes)
  if (env.NODE_ENV !== 'production') {
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))
  }
  app.use('/api/auth', authRoutes)
  app.use('/api/super-admin', superAdminRoutes)
  app.use('/api/central-admin', centralAdminRoutes)
  app.use('/api/institutions', institutionsRoutes)

  // School routes — protected by subscription enforcement
  const sub = enforceSubscription
  app.use('/api/academics', sub, academicsRoutes)
  app.use('/api/students', sub, studentsRoutes)
  app.use('/api/teachers', sub, teachersRoutes)
  app.use('/api/schedule', sub, scheduleRoutes)
  app.use('/api/calendar', sub, calendarRoutes)
  app.use('/api/homeworks', sub, homeworksRoutes)
  app.use('/api/parents', sub, parentsRoutes)
  app.use('/api/grades', sub, gradesRoutes)
  app.use('/api/attendance', sub, attendanceRoutes)
  app.use('/api/discipline', sub, disciplineRoutes)
  app.use('/api/notifications', sub, notificationsRoutes)
  app.use('/api/teacher-badges', sub, teacherBadgesRoutes)
  app.use('/api/payments', sub, paymentsRoutes)
  app.use('/api/shop', sub, shopRoutes)
  app.use('/api/documents', sub, documentsRoutes)
  app.use('/api/messages', sub, messagesRoutes)
  app.use('/api/dashboard', sub, dashboardRoutes)
  app.use('/api/reports', sub, reportsRoutes)

  app.use((_req, _res, next) => next(new ApiError(404, 'Route introuvable', 'ROUTE_NOT_FOUND')))
  app.use(errorHandler)

  return app
}
