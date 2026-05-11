import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import type { UserRole, UserStatus } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import type { AuthenticatedUser } from '../auth/auth.types'

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers() {
    const users = await this.prisma.user.findMany({
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        id: true,
        phoneNumber: true,
        displayName: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    })

    return {
      items: users
    }
  }

  async updateStatus(actor: AuthenticatedUser, userId: string, status: UserStatus) {
    if (actor.id === userId && status === 'disabled') {
      throw new BadRequestException('Cannot disable yourself')
    }

    const target = await this.findUserOrThrow(userId)

    if (target.role === 'super_admin' && actor.role !== 'super_admin') {
      throw new ForbiddenException('Only super admin can update super admin users')
    }

    const user = await this.prisma.user.update({
      where: {
        id: userId
      },
      data: {
        status
      },
      select: this.userSelect()
    })

    if (status === 'disabled') {
      await this.revokeUserRefreshTokens(userId)
    }

    return user
  }

  async updateRole(actor: AuthenticatedUser, userId: string, role: UserRole) {
    if (actor.role !== 'super_admin') {
      throw new ForbiddenException('Only super admin can update user roles')
    }

    if (actor.id === userId && role !== 'super_admin') {
      throw new BadRequestException('Cannot remove your own super admin role')
    }

    await this.findUserOrThrow(userId)

    return this.prisma.user.update({
      where: {
        id: userId
      },
      data: {
        role
      },
      select: this.userSelect()
    })
  }

  private async findUserOrThrow(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId
      },
      select: this.userSelect()
    })

    if (!user) {
      throw new NotFoundException('User not found')
    }

    return user
  }

  private async revokeUserRefreshTokens(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    })
  }

  private userSelect() {
    return {
      id: true,
      phoneNumber: true,
      displayName: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true
    } as const
  }
}
