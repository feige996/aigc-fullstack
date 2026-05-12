import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import type { TaskResultMessage } from '@aigc/shared-contracts'
import { PrismaService } from '../prisma/prisma.service'
import { RabbitmqService } from '../rabbitmq/rabbitmq.service'
import { GenerationEventsService } from './generation-events.service'
import { buildOutputAssetCreates } from './generation-output-assets'
import { toPrismaJson } from './generation.serializer'

@Injectable()
export class GenerationResultConsumerService implements OnModuleInit {
  private readonly logger = new Logger(GenerationResultConsumerService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitmqService: RabbitmqService,
    private readonly generationEvents: GenerationEventsService
  ) {}

  async onModuleInit() {
    try {
      await this.rabbitmqService.consumeGenerationResults((message) =>
        this.handleResult(message as TaskResultMessage)
      )
      this.logger.log('Consuming generation result messages')
    } catch (error) {
      this.logger.warn(`Generation result consumer is not running: ${(error as Error).message}`)
    }
  }

  private async handleResult(message: TaskResultMessage) {
    if (message.status === 'succeeded') {
      await this.markSucceeded(message)
      return
    }

    await this.markFailed(message)
  }

  private async markSucceeded(message: TaskResultMessage) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const task = await tx.task.findUnique({
        where: { id: message.taskId },
        select: {
          userId: true,
          projectId: true,
          status: true,
          currentAttemptId: true
        }
      })

      if (!task || task.status === 'succeeded' || task.status === 'canceled' || task.status === 'final_failed') {
        return false
      }

      if (task.currentAttemptId !== message.attemptId) {
        return false
      }

      await tx.taskAttempt.update({
        where: { id: message.attemptId },
        data: {
          status: 'succeeded',
          stage: 'completed',
          endedAt: new Date()
        }
      })

      const outputAssets = buildOutputAssetCreates({
        task: {
          id: message.taskId,
          userId: task.userId,
          projectId: task.projectId
        },
        message
      })

      if (outputAssets.length > 0) {
        await tx.asset.createMany({
          data: outputAssets,
          skipDuplicates: true
        })
      }

      await tx.task.update({
        where: { id: message.taskId },
        data: {
          status: 'succeeded',
          stage: 'completed',
          resultPayload: toPrismaJson(message.outputs),
          usagePayload: message.usage ? toPrismaJson(message.usage) : undefined,
          completedAt: new Date()
        }
      })

      return task.userId
    })

    if (!updated) {
      this.logger.warn(`Skipped stale success result task_id=${message.taskId} attempt_id=${message.attemptId}`)
      return
    }

    this.generationEvents.publishTaskEvent('task.succeeded', {
      taskId: message.taskId,
      userId: updated,
      status: 'succeeded',
      stage: 'completed'
    })

    this.logger.log(`Marked generation task ${message.taskId} as succeeded`)
  }

  private async markFailed(message: TaskResultMessage) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const task = await tx.task.findUnique({
        where: { id: message.taskId },
        select: {
          userId: true,
          status: true,
          currentAttemptId: true
        }
      })

      if (!task || task.status === 'succeeded' || task.status === 'canceled' || task.status === 'final_failed') {
        return false
      }

      if (task.currentAttemptId !== message.attemptId) {
        return false
      }

      await tx.taskAttempt.update({
        where: { id: message.attemptId },
        data: {
          status: 'failed',
          failureCode: 'PROVIDER_FAILED',
          retryable: message.error?.retryable ?? true,
          rawError: message.error ?? undefined,
          endedAt: new Date()
        }
      })

      await tx.task.update({
        where: { id: message.taskId },
        data: {
          status: 'failed',
          failureCode: 'PROVIDER_FAILED',
          resultPayload: message.error ? toPrismaJson({ error: message.error }) : undefined,
          usagePayload: message.usage ? toPrismaJson(message.usage) : undefined
        }
      })

      return task.userId
    })

    if (!updated) {
      this.logger.warn(`Skipped stale failed result task_id=${message.taskId} attempt_id=${message.attemptId}`)
      return
    }

    this.generationEvents.publishTaskEvent('task.failed', {
      taskId: message.taskId,
      userId: updated,
      status: 'failed',
      stage: 'completed',
      failureCode: 'PROVIDER_FAILED'
    })

    this.logger.log(`Marked generation task ${message.taskId} as failed`)
  }
}
