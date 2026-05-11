import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { UserRole } from '@prisma/client'
import type { AuthenticatedUser } from './auth.types'
import { ROLES_KEY } from './roles.decorator'

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass()
    ])

    if (!requiredRoles?.length) {
      return true
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>()
    const user = request.user

    if (user && requiredRoles.includes(user.role)) {
      return true
    }

    throw new ForbiddenException('Insufficient role')
  }
}

