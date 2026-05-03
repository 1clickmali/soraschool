import type { UserRole } from '@prisma/client'

declare global {
  namespace Express {
    interface AuthUser {
      id: string
      role: UserRole
      institutionId: string | null
      establishmentId: string | null
    }

    interface Request {
      user?: AuthUser
      institutionId?: string
    }
  }
}

export {}
