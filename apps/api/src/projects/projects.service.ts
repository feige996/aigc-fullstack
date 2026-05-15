import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma, ProjectStatus } from '@prisma/client'
import { parseEnumFilter, parsePagination, parseSearch, parseSortDirection } from '../common/list-query'
import type { AuthenticatedUser } from '../auth/auth.types'
import { PrismaService } from '../prisma/prisma.service'
import type { CreateProjectDto } from './dto/create-project.dto'

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async createProject(user: AuthenticatedUser, dto: CreateProjectDto) {
    try {
      const project = await this.prisma.project.create({
        data: {
          userId: user.id,
          name: dto.name.trim(),
          description: dto.description?.trim() || null
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

      return this.serializeProject(project)
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Project name already exists')
      }

      throw error
    }
  }

  async listProjects(user: AuthenticatedUser, query: Record<string, unknown> = {}) {
    const pagination = parsePagination(query, {
      defaultPageSize: 20,
      maxPageSize: 100
    })
    const search = parseSearch(query.search)
    const status = parseEnumFilter(query.status, Object.values(ProjectStatus))
    const sortBy = query.sortBy === 'updatedAt' ? 'updatedAt' : 'createdAt'
    const sortDirection = parseSortDirection(query.sortDirection)
    const where: Prisma.ProjectWhereInput = {
      ...this.projectAccessWhere(user),
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { id: { contains: search } },
              { userId: { contains: search } },
              { name: { contains: search } },
              { description: { contains: search } },
              {
                user: {
                  OR: [
                    { phoneNumber: { contains: search } },
                    { displayName: { contains: search } }
                  ]
                }
              }
            ]
          }
        : {})
    }

    const [total, projects] = await this.prisma.$transaction([
      this.prisma.project.count({ where }),
      this.prisma.project.findMany({
        where,
        orderBy: {
          [sortBy]: sortDirection
        },
        skip: pagination.skip,
        take: pagination.take,
        include: {
          user: {
            select: {
              id: true,
              phoneNumber: true,
              displayName: true
            }
          },
          _count: {
            select: {
              tasks: true
            }
          }
        }
      })
    ])

    return {
      items: projects.map((project) => this.serializeProject(project)),
      total,
      page: pagination.page,
      pageSize: pagination.pageSize
    }
  }

  async getProject(user: AuthenticatedUser, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        ...this.projectAccessWhere(user)
      },
      include: {
        user: {
          select: {
            id: true,
            phoneNumber: true,
            displayName: true
          }
        },
        _count: {
          select: {
            tasks: true
          }
        }
      }
    })

    if (!project) {
      throw new NotFoundException(`Project ${projectId} was not found`)
    }

    return this.serializeProject(project)
  }

  private projectAccessWhere(user: AuthenticatedUser) {
    if (user.role === 'admin' || user.role === 'super_admin') {
      return {}
    }

    return {
      userId: user.id
    }
  }

  private serializeProject(project: {
    id: string
    userId: string
    name: string
    description: string | null
    status: string
    createdAt: Date
    updatedAt: Date
    user?: {
      id: string
      phoneNumber: string
      displayName: string | null
    }
    _count?: {
      tasks: number
    }
  }) {
    return {
      projectId: project.id,
      userId: project.userId,
      name: project.name,
      description: project.description,
      status: project.status,
      taskCount: project._count?.tasks,
      user: project.user,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString()
    }
  }
}
