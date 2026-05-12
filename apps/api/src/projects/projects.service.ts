import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
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

  async listProjects(user: AuthenticatedUser) {
    const projects = await this.prisma.project.findMany({
      where: this.projectAccessWhere(user),
      orderBy: {
        createdAt: 'desc'
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

    return {
      items: projects.map((project) => this.serializeProject(project))
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
