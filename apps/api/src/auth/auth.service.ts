import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService, type JwtSignOptions } from '@nestjs/jwt'
import { Prisma, User } from '@prisma/client'
import { compare, hash } from 'bcryptjs'
import { createHash, randomBytes } from 'node:crypto'
import { PrismaService } from '../prisma/prisma.service'
import type { AuthenticatedUser } from './auth.types'

interface TokenPairInput {
  id: string
  phoneNumber: string
  role: User['role']
  status: User['status']
}

interface PhonePasswordInput {
  phoneNumber: string
  password: string
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  async register({
    phoneNumber,
    password,
    displayName
  }: PhonePasswordInput & { displayName?: string }) {
    const normalizedPhoneNumber = this.normalizePhoneNumber(phoneNumber)
    const passwordHash = await hash(password, 12)

    try {
      const user = await this.prisma.user.create({
        data: {
          phoneNumber: normalizedPhoneNumber,
          passwordHash,
          displayName
        }
      })

      return this.createAuthResponse(user)
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Phone number already exists')
      }

      throw error
    }
  }

  async login({ phoneNumber, password }: PhonePasswordInput) {
    const user = await this.prisma.user.findUnique({
      where: {
        phoneNumber: this.normalizePhoneNumber(phoneNumber)
      }
    })

    if (!user) {
      throw new UnauthorizedException('Invalid phone number or password')
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException('User is disabled')
    }

    const passwordValid = await compare(password, user.passwordHash)

    if (!passwordValid) {
      throw new UnauthorizedException('Invalid phone number or password')
    }

    return this.createAuthResponse(user)
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken)
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: {
        tokenHash
      },
      include: {
        user: true
      }
    })

    if (!storedToken || storedToken.revokedAt || storedToken.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Invalid refresh token')
    }

    if (storedToken.user.status !== 'active') {
      throw new UnauthorizedException('User is disabled')
    }

    await this.prisma.refreshToken.update({
      where: {
        id: storedToken.id
      },
      data: {
        revokedAt: new Date()
      }
    })

    return this.createAuthResponse(storedToken.user)
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: {
        tokenHash: this.hashToken(refreshToken),
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    })

    return {
      ok: true
    }
  }

  async getProfile(user: AuthenticatedUser) {
    return {
      id: user.id,
      phoneNumber: user.phoneNumber,
      role: user.role,
      status: user.status
    }
  }

  private async createAuthResponse(user: TokenPairInput) {
    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        phoneNumber: user.phoneNumber,
        role: user.role,
        status: user.status
      },
      {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET') ?? 'dev_access_secret',
        expiresIn: (this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') ??
          '15m') as JwtSignOptions['expiresIn']
      }
    )

    const refreshToken = randomBytes(48).toString('hex')
    const refreshTokenHash = this.hashToken(refreshToken)
    const refreshTokenDays = Number(this.configService.get<string>('JWT_REFRESH_EXPIRES_DAYS') ?? '30')

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt: new Date(Date.now() + refreshTokenDays * 24 * 60 * 60 * 1000)
      }
    })

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      user: {
        id: user.id,
        phoneNumber: user.phoneNumber,
        role: user.role,
        status: user.status
      }
    }
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex')
  }

  private normalizePhoneNumber(phoneNumber: string) {
    return phoneNumber.trim()
  }
}
