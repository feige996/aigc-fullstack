import type { UserRole, UserStatus } from '@prisma/client'

export interface AuthenticatedUser {
  id: string
  phoneCountryCode: string
  phoneNumber: string
  role: UserRole
  status: UserStatus
}
