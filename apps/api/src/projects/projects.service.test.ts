import { NotFoundException } from '@nestjs/common'
import assert from 'node:assert/strict'
import test from 'node:test'
import type { AuthenticatedUser } from '../auth/auth.types'
import { ProjectsService } from './projects.service'

type MockCall = {
  arguments: any[]
}

type MockFn = ((...args: any[]) => any) & {
  mock: {
    calls: MockCall[]
    mockImplementationOnce: (implementation: (...args: any[]) => any) => void
  }
}

function mockFn(): MockFn {
  const calls: MockCall[] = []
  const onceImplementations: Array<(...args: any[]) => any> = []
  const fn = ((...args: any[]) => {
    calls.push({ arguments: args })
    const nextImplementation = onceImplementations.shift()

    return nextImplementation?.(...args)
  }) as MockFn

  fn.mock = {
    calls,
    mockImplementationOnce: (nextImplementation: (...args: any[]) => any) => {
      onceImplementations.push(nextImplementation)
    }
  }

  return fn
}

function createMockPrisma() {
  return {
    project: {
      create: mockFn(),
      findFirst: mockFn(),
      findMany: mockFn()
    }
  }
}

function createProject(overrides: Record<string, unknown> = {}) {
  return {
    id: 'project_1',
    userId: 'user_1',
    name: 'Launch Images',
    description: 'Product campaign',
    status: 'active',
    createdAt: new Date('2026-05-14T00:00:00.000Z'),
    updatedAt: new Date('2026-05-14T01:00:00.000Z'),
    user: {
      id: 'user_1',
      phoneNumber: '13900139000',
      displayName: 'User One'
    },
    _count: {
      tasks: 2
    },
    ...overrides
  }
}

const regularUser: AuthenticatedUser = {
  id: 'user_1',
  phoneNumber: '13900139000',
  role: 'user',
  status: 'active'
}

const adminUser: AuthenticatedUser = {
  id: 'admin_1',
  phoneNumber: '13900139001',
  role: 'admin',
  status: 'active'
}

test('createProject trims text fields and serializes the created project', async () => {
  const prisma = createMockPrisma()
  const service = new ProjectsService(prisma as never)

  prisma.project.create.mock.mockImplementationOnce(async () => createProject())

  const result = await service.createProject(regularUser, {
    name: ' Launch Images ',
    description: ' Product campaign '
  })

  assert.deepEqual(prisma.project.create.mock.calls[0]?.arguments[0], {
    data: {
      userId: 'user_1',
      name: 'Launch Images',
      description: 'Product campaign'
    },
    include: {
      user: {
        select: {
          id: true,
          phoneNumber: true,
          displayName: true
        }
      }
    }
  })
  assert.deepEqual(result, {
    projectId: 'project_1',
    userId: 'user_1',
    name: 'Launch Images',
    description: 'Product campaign',
    status: 'active',
    taskCount: 2,
    user: {
      id: 'user_1',
      phoneNumber: '13900139000',
      displayName: 'User One'
    },
    createdAt: '2026-05-14T00:00:00.000Z',
    updatedAt: '2026-05-14T01:00:00.000Z'
  })
})

test('createProject stores blank descriptions as null', async () => {
  const prisma = createMockPrisma()
  const service = new ProjectsService(prisma as never)

  prisma.project.create.mock.mockImplementationOnce(async () => createProject({ description: null }))

  await service.createProject(regularUser, {
    name: 'Launch Images',
    description: '   '
  })

  assert.equal(prisma.project.create.mock.calls[0]?.arguments[0].data.description, null)
})

test('listProjects scopes regular users to their own projects', async () => {
  const prisma = createMockPrisma()
  const service = new ProjectsService(prisma as never)

  prisma.project.findMany.mock.mockImplementationOnce(async () => [createProject()])

  const result = await service.listProjects(regularUser)

  assert.equal(result.items.length, 1)
  assert.deepEqual(prisma.project.findMany.mock.calls[0]?.arguments[0].where, {
    userId: 'user_1'
  })
  assert.deepEqual(prisma.project.findMany.mock.calls[0]?.arguments[0].orderBy, {
    createdAt: 'desc'
  })
})

test('listProjects allows admins to see all projects', async () => {
  const prisma = createMockPrisma()
  const service = new ProjectsService(prisma as never)

  prisma.project.findMany.mock.mockImplementationOnce(async () => [createProject()])

  await service.listProjects(adminUser)

  assert.deepEqual(prisma.project.findMany.mock.calls[0]?.arguments[0].where, {})
})

test('getProject enforces regular user access and serializes task count', async () => {
  const prisma = createMockPrisma()
  const service = new ProjectsService(prisma as never)

  prisma.project.findFirst.mock.mockImplementationOnce(async () => createProject())

  const result = await service.getProject(regularUser, 'project_1')

  assert.equal(result.taskCount, 2)
  assert.deepEqual(prisma.project.findFirst.mock.calls[0]?.arguments[0].where, {
    id: 'project_1',
    userId: 'user_1'
  })
})

test('getProject allows admin access without user scoping', async () => {
  const prisma = createMockPrisma()
  const service = new ProjectsService(prisma as never)

  prisma.project.findFirst.mock.mockImplementationOnce(async () => createProject())

  await service.getProject(adminUser, 'project_1')

  assert.deepEqual(prisma.project.findFirst.mock.calls[0]?.arguments[0].where, {
    id: 'project_1'
  })
})

test('getProject throws NotFoundException when project is unavailable', async () => {
  const prisma = createMockPrisma()
  const service = new ProjectsService(prisma as never)

  prisma.project.findFirst.mock.mockImplementationOnce(async () => null)

  await assert.rejects(service.getProject(regularUser, 'missing_project'), NotFoundException)
})
