import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma, UserRole, UserStatus } from '@prisma/client'
import { parseEnumFilter, parsePagination, parseSearch, parseSortDirection } from '../common/list-query'
import { PrismaService } from '../prisma/prisma.service'
import type { AuthenticatedUser } from '../auth/auth.types'

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(query: Record<string, unknown> = {}) {
    const pagination = parsePagination(query, {
      defaultPageSize: 20,
      maxPageSize: 100
    })
    const search = parseSearch(query.search)
    const role = parseEnumFilter(query.role, Object.values(UserRole))
    const status = parseEnumFilter(query.status, Object.values(UserStatus))
    const sortBy = query.sortBy === 'updatedAt' ? 'updatedAt' : 'createdAt'
    const sortDirection = parseSortDirection(query.sortDirection)
    const where: Prisma.UserWhereInput = {
      ...(role ? { role } : {}),
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { id: { contains: search } },
              { phoneNumber: { contains: search } },
              { displayName: { contains: search } }
            ]
          }
        : {})
    }

    const [total, users] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: {
          [sortBy]: sortDirection
        },
        skip: pagination.skip,
        take: pagination.take,
        select: this.userSelect()
      })
    ])

    return {
      items: users,
      total,
      page: pagination.page,
      pageSize: pagination.pageSize
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
