import { env } from './config/env'
import { disconnectPrisma } from './config/prisma'
import { createApp } from './app'
import { logger } from './lib/logger'
import { suspendExpiredSubscriptions } from './modules/super-admin/super-admin.routes'

const app = createApp()

const server = app.listen(env.PORT, () => {
  logger.info(`${env.APP_NAME} API ready on http://localhost:${env.PORT}`)
  logger.info(`Swagger docs on http://localhost:${env.PORT}/docs`)
})

const interval = setInterval(() => {
  suspendExpiredSubscriptions().catch((err) => logger.error({ err }, 'Subscription expiration job failed'))
}, 60 * 60 * 1000)

async function shutdown(signal: string) {
  logger.info({ signal }, `Shutting down ${env.APP_NAME} API`)
  clearInterval(interval)
  server.close(async () => {
    await disconnectPrisma()
    process.exit(0)
  })
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
