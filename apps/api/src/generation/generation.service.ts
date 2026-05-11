import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type { GenerationRequestMessage } from '@aigc/shared-contracts'
import type { Prisma } from '@prisma/client'
import { createHash, randomUUID } from 'node:crypto'
import { PrismaService } from '../prisma/prisma.service'
import { CreateGenerationTaskDto } from './dto/create-generation-task.dto'
import { GenerationEventsService } from './generation-events.service'
import { GenerationPublisherService } from './generation-publisher.service'
import type { AuthenticatedUser } from '../auth/auth.types'

interface CreateTaskInput {
  userId: string
  dto: CreateGenerationTaskDto
}

interface UserScopedInput {
  user: AuthenticatedUser
}

interface GetTaskInput extends UserScopedInput {
  taskId: string
}

interface GetExecutionStateInput {
  taskId: string
  attemptId: string
}

interface RequestPayload {
  clientRequestId?: string
  type: string
  model: string
  prompt: string
  ratio?: string
  duration?: number
  referenceAssetIds: string[]
}

@Injectable()
export class GenerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly generationEvents: GenerationEventsService,
    private readonly generationPublisher: GenerationPublisherService
  ) {}

  async createTask({ userId, dto }: CreateTaskInput) {
    const requestPayload: RequestPayload = {
      clientRequestId: dto.clientRequestId,
      type: dto.type,
      model: dto.model,
      prompt: dto.prompt,
      ratio: dto.ratio,
      duration: dto.duration,
      referenceAssetIds: dto.referenceAssetIds ?? []
    }

    const requestPayloadHash = this.hashPayload(requestPayload)

    const task = await this.prisma.$transaction(async (tx) => {
      const createdTask = await tx.generationTask.create({
        data: {
          userId,
          type: dto.type,
          model: dto.model,
          status: 'pending',
          stage: 'queue_publish',
          billingStatus: 'none',
          requestPayload: this.toJson(requestPayload),
          maxAttempts: 3
        }
      })

      const attempt = await tx.generationTaskAttempt.create({
        data: {
          taskId: createdTask.id,
          attemptNo: 1,
          status: 'pending',
          stage: 'queue_publish',
          idempotencyKey: `${createdTask.id}:attempt:1:${randomUUID()}`,
          requestPayloadHash
        }
      })

      return tx.generationTask.update({
        where: { id: createdTask.id },
        data: {
          currentAttemptId: attempt.id
        },
        include: {
          currentAttempt: true
        }
      })
    })

    return this.publishAttempt({
      userId,
      taskId: task.id,
      requestPayload,
      attempt: task.currentAttempt
    })
  }

  async retryTask({ user, taskId }: GetTaskInput) {
    const existingTask = await this.prisma.generationTask.findFirst({
      where: {
        id: taskId,
        ...this.taskAccessWhere(user)
      },
      include: {
        attempts: {
          orderBy: {
            attemptNo: 'desc'
          }
        }
      }
    })

    if (!existingTask) {
      throw new NotFoundException(`Generation task ${taskId} was not found`)
    }

    if (existingTask.status === 'succeeded') {
      throw new BadRequestException('Succeeded task cannot be retried')
    }

    if (existingTask.attempts.length >= existingTask.maxAttempts) {
      throw new BadRequestException('Task has reached max attempts')
    }

    const requestPayload = existingTask.requestPayload as unknown as RequestPayload
    const nextAttemptNo = (existingTask.attempts[0]?.attemptNo ?? 0) + 1
    const requestPayloadHash = this.hashPayload(requestPayload)

    const task = await this.prisma.$transaction(async (tx) => {
      const attempt = await tx.generationTaskAttempt.create({
        data: {
          taskId: existingTask.id,
          attemptNo: nextAttemptNo,
          status: 'pending',
          stage: 'queue_publish',
          idempotencyKey: `${existingTask.id}:attempt:${nextAttemptNo}:${randomUUID()}`,
          requestPayloadHash
        }
      })

      return tx.generationTask.update({
        where: { id: existingTask.id },
        data: {
          status: 'retrying',
          stage: 'queue_publish',
          failureCode: null,
          currentAttemptId: attempt.id
        },
        include: {
          currentAttempt: true
        }
      })
    })

    return this.publishAttempt({
      userId: existingTask.userId,
      taskId: task.id,
      requestPayload,
      attempt: task.currentAttempt
    })
  }

  async cancelTask({ user, taskId }: GetTaskInput) {
    const task = await this.prisma.generationTask.findFirst({
      where: {
        id: taskId,
        ...this.taskAccessWhere(user)
      },
      include: {
        currentAttempt: true
      }
    })

    if (!task) {
      throw new NotFoundException(`Generation task ${taskId} was not found`)
    }

    if (task.status === 'succeeded' || task.status === 'canceled' || task.status === 'final_failed') {
      throw new BadRequestException(`Task with status ${task.status} cannot be canceled`)
    }

    const canceledTask = await this.prisma.$transaction(async (tx) => {
      if (task.currentAttempt) {
        await tx.generationTaskAttempt.update({
          where: { id: task.currentAttempt.id },
          data: {
            status: 'canceled',
            failureCode: 'USER_CANCELED',
            retryable: false,
            endedAt: new Date()
          }
        })
      }

      return tx.generationTask.update({
        where: { id: task.id },
        data: {
          status: 'canceled',
          failureCode: 'USER_CANCELED',
          completedAt: new Date()
        },
        include: {
          currentAttempt: true
        }
      })
    })

    this.generationEvents.publishTaskEvent('task.canceled', {
      taskId: canceledTask.id,
      userId: canceledTask.userId,
      status: canceledTask.status,
      stage: canceledTask.stage,
      failureCode: canceledTask.failureCode
    })

    return {
      taskId: canceledTask.id,
      attemptId: canceledTask.currentAttempt?.id,
      status: canceledTask.status,
      stage: canceledTask.stage,
      failureCode: canceledTask.failureCode,
      billingStatus: canceledTask.billingStatus
    }
  }

  async listTasks({ user }: UserScopedInput) {
    const tasks = await this.prisma.generationTask.findMany({
      where: {
        userId: user.id
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 20,
      include: {
        currentAttempt: true
      }
    })

    return {
      items: tasks.map((task) => this.serializeTask(task))
    }
  }

  async listAdminTasks() {
    const tasks = await this.prisma.generationTask.findMany({
      orderBy: {
        createdAt: 'desc'
      },
      take: 50,
      include: {
        currentAttempt: true
      }
    })

    return {
      items: tasks.map((task) => this.serializeTask(task))
    }
  }

  async getTask({ user, taskId }: GetTaskInput) {
    const task = await this.prisma.generationTask.findFirst({
      where: {
        id: taskId,
        ...this.taskAccessWhere(user)
      },
      include: {
        currentAttempt: true,
        attempts: {
          orderBy: {
            attemptNo: 'asc'
          }
        }
      }
    })

    if (!task) {
      throw new NotFoundException(`Generation task ${taskId} was not found`)
    }

    return this.serializeTask(task)
  }

  async getExecutionState({ taskId, attemptId }: GetExecutionStateInput) {
    const task = await this.prisma.generationTask.findUnique({
      where: {
        id: taskId
      },
      select: {
        status: true,
        currentAttemptId: true,
        currentAttempt: {
          select: {
            id: true,
            status: true
          }
        }
      }
    })

    if (!task) {
      return {
        executable: false,
        reason: 'TASK_NOT_FOUND'
      }
    }

    if (task.currentAttemptId !== attemptId) {
      return {
        executable: false,
        reason: 'STALE_ATTEMPT',
        taskStatus: task.status,
        currentAttemptId: task.currentAttemptId
      }
    }

    if (['succeeded', 'canceled', 'final_failed', 'rejected', 'expired'].includes(task.status)) {
      return {
        executable: false,
        reason: 'TASK_NOT_EXECUTABLE',
        taskStatus: task.status,
        currentAttemptId: task.currentAttemptId
      }
    }

    if (!task.currentAttempt || ['succeeded', 'canceled', 'failed'].includes(task.currentAttempt.status)) {
      return {
        executable: false,
        reason: 'ATTEMPT_NOT_EXECUTABLE',
        taskStatus: task.status,
        attemptStatus: task.currentAttempt?.status,
        currentAttemptId: task.currentAttemptId
      }
    }

    return {
      executable: true,
      taskStatus: task.status,
      attemptStatus: task.currentAttempt.status,
      currentAttemptId: task.currentAttemptId
    }
  }

  private serializeTask(task: {
    id: string
    userId: string
    projectId: string | null
    type: string
    model: string
    status: string
    stage: string
    failureCode: string | null
    billingStatus: string
    currentAttemptId: string | null
    maxAttempts: number
    requestPayload: unknown
    createdAt: Date
    updatedAt: Date
    completedAt: Date | null
    currentAttempt?: unknown
    attempts?: unknown[]
  }) {
    return {
      taskId: task.id,
      userId: task.userId,
      projectId: task.projectId,
      type: task.type,
      model: task.model,
      status: task.status,
      stage: task.stage,
      failureCode: task.failureCode,
      billingStatus: task.billingStatus,
      currentAttemptId: task.currentAttemptId,
      maxAttempts: task.maxAttempts,
      requestPayload: task.requestPayload,
      currentAttempt: task.currentAttempt,
      attempts: task.attempts,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      completedAt: task.completedAt?.toISOString() ?? null
    }
  }

  private taskAccessWhere(user: AuthenticatedUser) {
    if (user.role === 'admin' || user.role === 'super_admin') {
      return {}
    }

    return {
      userId: user.id
    }
  }

  private async publishAttempt({
    userId,
    taskId,
    requestPayload,
    attempt
  }: {
    userId: string
    taskId: string
    requestPayload: RequestPayload
    attempt?: {
      id: string
      attemptNo: number
      idempotencyKey: string
    } | null
  }) {
    if (!attempt) {
      throw new Error(`Task ${taskId} was created without current attempt`)
    }

    const traceId = randomUUID()
    const message: GenerationRequestMessage = {
      traceId,
      taskId,
      attemptId: attempt.id,
      userId,
      type: requestPayload.type,
      model: requestPayload.model,
      input: {
        prompt: requestPayload.prompt,
        ratio: requestPayload.ratio,
        duration: requestPayload.duration,
        referenceAssetIds: requestPayload.referenceAssetIds ?? []
      },
      idempotencyKey: attempt.idempotencyKey,
      attempt: attempt.attemptNo
    }

    try {
      await this.generationPublisher.publishGenerationRequest(message)

      const queuedTask = await this.prisma.$transaction(async (tx) => {
        await tx.generationTaskAttempt.update({
          where: { id: attempt.id },
          data: {
            status: 'queued'
          }
        })

        return tx.generationTask.update({
          where: { id: taskId },
          data: {
            status: 'queued'
          },
          include: {
            currentAttempt: true
          }
        })
      })

      this.generationEvents.publishTaskEvent('task.queued', {
        taskId: queuedTask.id,
        userId: queuedTask.userId,
        status: queuedTask.status,
        stage: queuedTask.stage,
        failureCode: queuedTask.failureCode
      })

      return {
        taskId: queuedTask.id,
        attemptId: queuedTask.currentAttempt?.id,
        traceId,
        status: queuedTask.status,
        stage: queuedTask.stage,
        billingStatus: queuedTask.billingStatus
      }
    } catch {
      const failedTask = await this.prisma.$transaction(async (tx) => {
        await tx.generationTaskAttempt.update({
          where: { id: attempt.id },
          data: {
            status: 'failed',
            failureCode: 'QUEUE_PUBLISH_FAILED',
            retryable: true,
            endedAt: new Date()
          }
        })

        return tx.generationTask.update({
          where: { id: taskId },
          data: {
            status: 'failed',
            failureCode: 'QUEUE_PUBLISH_FAILED'
          },
          include: {
            currentAttempt: true
          }
        })
      })

      this.generationEvents.publishTaskEvent('task.failed', {
        taskId: failedTask.id,
        userId: failedTask.userId,
        status: failedTask.status,
        stage: failedTask.stage,
        failureCode: failedTask.failureCode
      })

      return {
        taskId: failedTask.id,
        attemptId: failedTask.currentAttempt?.id,
        traceId,
        status: failedTask.status,
        stage: failedTask.stage,
        failureCode: failedTask.failureCode,
        billingStatus: failedTask.billingStatus
      }
    }
  }

  private hashPayload(payload: RequestPayload) {
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex')
  }

  private toJson(payload: RequestPayload): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(payload)) as Prisma.InputJsonValue
  }
}
