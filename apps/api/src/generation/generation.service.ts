import { Injectable, NotFoundException } from '@nestjs/common'
import type { GenerationRequestMessage } from '@aigc/shared-contracts'
import { createHash, randomUUID } from 'node:crypto'
import { PrismaService } from '../prisma/prisma.service'
import { CreateGenerationTaskDto } from './dto/create-generation-task.dto'
import { GenerationPublisherService } from './generation-publisher.service'

interface CreateTaskInput {
  userId: string
  dto: CreateGenerationTaskDto
}

interface UserScopedInput {
  userId: string
}

interface GetTaskInput extends UserScopedInput {
  taskId: string
}

@Injectable()
export class GenerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly generationPublisher: GenerationPublisherService
  ) {}

  async createTask({ userId, dto }: CreateTaskInput) {
    const requestPayload = {
      clientRequestId: dto.clientRequestId,
      type: dto.type,
      model: dto.model,
      prompt: dto.prompt,
      ratio: dto.ratio,
      duration: dto.duration,
      referenceAssetIds: dto.referenceAssetIds ?? []
    }

    const requestPayloadHash = createHash('sha256')
      .update(JSON.stringify(requestPayload))
      .digest('hex')

    const task = await this.prisma.$transaction(async (tx) => {
      const createdTask = await tx.generationTask.create({
        data: {
          userId,
          type: dto.type,
          model: dto.model,
          status: 'pending',
          stage: 'queue_publish',
          billingStatus: 'none',
          requestPayload,
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

    const attempt = task.currentAttempt

    if (!attempt) {
      throw new Error(`Task ${task.id} was created without current attempt`)
    }

    const traceId = randomUUID()
    const message: GenerationRequestMessage = {
      traceId,
      taskId: task.id,
      attemptId: attempt.id,
      userId,
      type: dto.type,
      model: dto.model,
      input: {
        prompt: dto.prompt,
        ratio: dto.ratio,
        duration: dto.duration,
        referenceAssetIds: dto.referenceAssetIds ?? []
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
          where: { id: task.id },
          data: {
            status: 'queued'
          },
          include: {
            currentAttempt: true
          }
        })
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
          where: { id: task.id },
          data: {
            status: 'failed',
            failureCode: 'QUEUE_PUBLISH_FAILED'
          },
          include: {
            currentAttempt: true
          }
        })
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

  async listTasks({ userId }: UserScopedInput) {
    const tasks = await this.prisma.generationTask.findMany({
      where: {
        userId
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

  async getTask({ userId, taskId }: GetTaskInput) {
    const task = await this.prisma.generationTask.findFirst({
      where: {
        id: taskId,
        userId
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
}
