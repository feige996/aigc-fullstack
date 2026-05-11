import type { UserRole } from '@prisma/client'

export interface AuthenticatedUser {
  id: string
  phoneCountryCode: string
  phoneNumber: string
  email: string | null
  role: UserRole
}
