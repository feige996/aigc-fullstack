import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import type { AuthenticatedUser } from './auth.types'

interface JwtPayload {
  sub: string
  phoneCountryCode: string
  phoneNumber: string
  email?: string | null
  role: AuthenticatedUser['role']
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (request: { query?: { access_token?: string } }) => request.query?.access_token ?? null
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_ACCESS_SECRET') ?? 'dev_access_secret'
    })
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    return {
      id: payload.sub,
      phoneCountryCode: payload.phoneCountryCode,
      phoneNumber: payload.phoneNumber,
      email: payload.email ?? null,
      role: payload.role
    }
  }
}
