import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { PrismaService } from '../prisma/prisma.service'
import type { AuthenticatedUser } from './auth.types'

interface JwtPayload {
  sub: string
  phoneCountryCode: string
  phoneNumber: string
  role: AuthenticatedUser['role']
  status: AuthenticatedUser['status']
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (request: { query?: { access_token?: string } }) => request.query?.access_token ?? null
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_ACCESS_SECRET') ?? 'dev_access_secret'
    })
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: {
        id: payload.sub
      },
      select: {
        id: true,
        phoneCountryCode: true,
        phoneNumber: true,
        role: true,
        status: true
      }
    })

    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('User is not active')
    }

    return {
      id: user.id,
      phoneCountryCode: user.phoneCountryCode,
      phoneNumber: user.phoneNumber,
      role: user.role,
      status: user.status
    }
  }
}
