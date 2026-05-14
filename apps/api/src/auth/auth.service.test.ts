import { NotFoundException, UnauthorizedException } from '@nestjs/common'
import { hash } from 'bcryptjs'
import assert from 'node:assert/strict'
import test from 'node:test'
import { AuthService } from './auth.service'

type MockCall = {
  arguments: any[]
}

type MockFn = ((...args: any[]) => any) & {
  mock: {
    calls: MockCall[]
    callCount: () => number
    mockImplementationOnce: (implementation: (...args: any[]) => any) => void
  }
}

function mockFn(implementation?: (...args: any[]) => any): MockFn {
  const calls: MockCall[] = []
  const onceImplementations: Array<(...args: any[]) => any> = []
  const fn = ((...args: any[]) => {
    calls.push({ arguments: args })
    const nextImplementation = onceImplementations.shift() ?? implementation

    return nextImplementation?.(...args)
  }) as MockFn

  fn.mock = {
    calls,
    callCount: () => calls.length,
    mockImplementationOnce: (nextImplementation: (...args: any[]) => any) => {
      onceImplementations.push(nextImplementation)
    }
  }

  return fn
}

function createMockPrisma() {
  return {
    $transaction: mockFn(async (operations: unknown[]) => operations),
    refreshToken: {
      create: mockFn(async (args: unknown) => args),
      findUnique: mockFn(),
      update: mockFn(async (args: unknown) => args),
      updateMany: mockFn(async (args: unknown) => args)
    },
    user: {
      findUnique: mockFn(),
      update: mockFn(async (args: unknown) => args)
    }
  }
}

function createAuthService(prisma = createMockPrisma()) {
  const jwtService = {
    signAsync: mockFn(async () => 'signed-access-token')
  }
  const configService = {
    get: mockFn((key: string) => {
      const values: Record<string, string> = {
        JWT_ACCESS_SECRET: 'test-access-secret',
        JWT_ACCESS_EXPIRES_IN: '10m',
        JWT_REFRESH_EXPIRES_DAYS: '7'
      }

      return values[key]
    })
  }

  return {
    authService: new AuthService(prisma as never, jwtService as never, configService as never),
    configService,
    jwtService,
    prisma
  }
}

test('login signs tokens and stores a refresh token for active users', async () => {
  const passwordHash = await hash('password123', 4)
  const { authService, jwtService, prisma } = createAuthService()

  prisma.user.findUnique.mock.mockImplementationOnce(async () => ({
    id: 'user_1',
    phoneNumber: '13900139000',
    passwordHash,
    role: 'user',
    status: 'active'
  }))

  const result = await authService.login({
    phoneNumber: ' 13900139000 ',
    password: 'password123'
  })

  assert.equal(result.accessToken, 'signed-access-token')
  assert.equal(result.tokenType, 'Bearer')
  assert.equal(result.refreshToken.length, 96)
  assert.deepEqual(result.user, {
    id: 'user_1',
    phoneNumber: '13900139000',
    role: 'user',
    status: 'active'
  })
  assert.deepEqual(prisma.user.findUnique.mock.calls[0]?.arguments[0], {
    where: {
      phoneNumber: '13900139000'
    }
  })
  assert.deepEqual(jwtService.signAsync.mock.calls[0]?.arguments[0], {
    sub: 'user_1',
    phoneNumber: '13900139000',
    role: 'user',
    status: 'active'
  })
  assert.equal(prisma.refreshToken.create.mock.callCount(), 1)
  assert.equal(prisma.refreshToken.create.mock.calls[0]?.arguments[0].data.userId, 'user_1')
  assert.equal(typeof prisma.refreshToken.create.mock.calls[0]?.arguments[0].data.tokenHash, 'string')
})

test('login rejects missing, disabled, and password-mismatched users', async () => {
  const passwordHash = await hash('password123', 4)
  const { authService, prisma } = createAuthService()

  prisma.user.findUnique.mock.mockImplementationOnce(async () => null)
  await assert.rejects(
    authService.login({ phoneNumber: '13900139000', password: 'password123' }),
    UnauthorizedException
  )

  prisma.user.findUnique.mock.mockImplementationOnce(async () => ({
    id: 'user_1',
    phoneNumber: '13900139000',
    passwordHash,
    role: 'user',
    status: 'disabled'
  }))
  await assert.rejects(
    authService.login({ phoneNumber: '13900139000', password: 'password123' }),
    UnauthorizedException
  )

  prisma.user.findUnique.mock.mockImplementationOnce(async () => ({
    id: 'user_1',
    phoneNumber: '13900139000',
    passwordHash,
    role: 'user',
    status: 'active'
  }))
  await assert.rejects(
    authService.login({ phoneNumber: '13900139000', password: 'wrong-password' }),
    UnauthorizedException
  )

  assert.equal(prisma.refreshToken.create.mock.callCount(), 0)
})

test('refresh revokes the used token and creates a replacement token', async () => {
  const { authService, prisma } = createAuthService()

  prisma.refreshToken.findUnique.mock.mockImplementationOnce(async () => ({
    id: 'refresh_1',
    revokedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    user: {
      id: 'user_1',
      phoneNumber: '13900139000',
      role: 'user',
      status: 'active'
    }
  }))

  const result = await authService.refresh('valid-refresh-token')

  assert.equal(result.accessToken, 'signed-access-token')
  assert.equal(result.refreshToken.length, 96)
  assert.deepEqual(prisma.refreshToken.update.mock.calls[0]?.arguments[0], {
    where: {
      id: 'refresh_1'
    },
    data: {
      revokedAt: prisma.refreshToken.update.mock.calls[0]?.arguments[0].data.revokedAt
    }
  })
  assert.equal(prisma.refreshToken.create.mock.callCount(), 1)
})

test('refresh rejects revoked, expired, or disabled-user tokens', async () => {
  const { authService, prisma } = createAuthService()

  prisma.refreshToken.findUnique.mock.mockImplementationOnce(async () => null)
  await assert.rejects(authService.refresh('missing-token'), UnauthorizedException)

  prisma.refreshToken.findUnique.mock.mockImplementationOnce(async () => ({
    id: 'refresh_1',
    revokedAt: new Date(),
    expiresAt: new Date(Date.now() + 60_000),
    user: {
      id: 'user_1',
      phoneNumber: '13900139000',
      role: 'user',
      status: 'active'
    }
  }))
  await assert.rejects(authService.refresh('revoked-token'), UnauthorizedException)

  prisma.refreshToken.findUnique.mock.mockImplementationOnce(async () => ({
    id: 'refresh_2',
    revokedAt: null,
    expiresAt: new Date(Date.now() - 60_000),
    user: {
      id: 'user_1',
      phoneNumber: '13900139000',
      role: 'user',
      status: 'active'
    }
  }))
  await assert.rejects(authService.refresh('expired-token'), UnauthorizedException)

  prisma.refreshToken.findUnique.mock.mockImplementationOnce(async () => ({
    id: 'refresh_3',
    revokedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    user: {
      id: 'user_1',
      phoneNumber: '13900139000',
      role: 'user',
      status: 'disabled'
    }
  }))
  await assert.rejects(authService.refresh('disabled-user-token'), UnauthorizedException)

  assert.equal(prisma.refreshToken.update.mock.callCount(), 0)
  assert.equal(prisma.refreshToken.create.mock.callCount(), 0)
})

test('changePassword validates the current password and revokes active refresh tokens', async () => {
  const passwordHash = await hash('old-password', 4)
  const { authService, prisma } = createAuthService()

  prisma.user.findUnique.mock.mockImplementationOnce(async () => ({
    id: 'user_1',
    phoneNumber: '13900139000',
    passwordHash,
    role: 'user',
    status: 'active'
  }))

  const result = await authService.changePassword('user_1', {
    currentPassword: 'old-password',
    newPassword: 'new-password'
  })

  assert.deepEqual(result, { ok: true })
  assert.equal(prisma.user.update.mock.calls[0]?.arguments[0].where.id, 'user_1')
  assert.equal(typeof prisma.user.update.mock.calls[0]?.arguments[0].data.passwordHash, 'string')
  assert.deepEqual(prisma.refreshToken.updateMany.mock.calls[0]?.arguments[0].where, {
    userId: 'user_1',
    revokedAt: null
  })
  assert.equal(prisma.$transaction.mock.callCount(), 1)
})

test('changePassword rejects unknown, disabled, and password-mismatched users', async () => {
  const passwordHash = await hash('old-password', 4)
  const { authService, prisma } = createAuthService()

  prisma.user.findUnique.mock.mockImplementationOnce(async () => null)
  await assert.rejects(
    authService.changePassword('missing_user', {
      currentPassword: 'old-password',
      newPassword: 'new-password'
    }),
    NotFoundException
  )

  prisma.user.findUnique.mock.mockImplementationOnce(async () => ({
    id: 'user_1',
    phoneNumber: '13900139000',
    passwordHash,
    role: 'user',
    status: 'disabled'
  }))
  await assert.rejects(
    authService.changePassword('user_1', {
      currentPassword: 'old-password',
      newPassword: 'new-password'
    }),
    UnauthorizedException
  )

  prisma.user.findUnique.mock.mockImplementationOnce(async () => ({
    id: 'user_1',
    phoneNumber: '13900139000',
    passwordHash,
    role: 'user',
    status: 'active'
  }))
  await assert.rejects(
    authService.changePassword('user_1', {
      currentPassword: 'wrong-password',
      newPassword: 'new-password'
    }),
    UnauthorizedException
  )

  assert.equal(prisma.$transaction.mock.callCount(), 0)
})
