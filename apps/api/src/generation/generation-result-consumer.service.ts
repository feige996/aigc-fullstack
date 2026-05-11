import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import type { GenerationResultMessage } from '@aigc/shared-contracts'
import { PrismaService } from '../prisma/prisma.service'
import { RabbitmqService } from '../rabbitmq/rabbitmq.service'
import { GenerationEventsService } from './generation-events.service'

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
        this.handleResult(message as GenerationResultMessage)
      )
      this.logger.log('Consuming generation result messages')
    } catch (error) {
      this.logger.warn(`Generation result consumer is not running: ${(error as Error).message}`)
    }
  }

  private async handleResult(message: GenerationResultMessage) {
    if (message.status === 'succeeded') {
      await this.markSucceeded(message)
      return
    }

    await this.markFailed(message)
  }

  private async markSucceeded(message: GenerationResultMessage) {
    await this.prisma.$transaction(async (tx) => {
      const task = await tx.generationTask.findUnique({
        where: { id: message.taskId },
        select: {
          status: true,
          currentAttemptId: true
        }
      })

      if (!task || task.status === 'succeeded' || task.status === 'final_failed') {
        return
      }

      if (task.currentAttemptId !== message.attemptId) {
        return
      }

      await tx.generationTaskAttempt.update({
        where: { id: message.attemptId },
        data: {
          status: 'succeeded',
          stage: 'completed',
          endedAt: new Date()
        }
      })

      await tx.generationTask.update({
        where: { id: message.taskId },
        data: {
          status: 'succeeded',
          stage: 'completed',
          completedAt: new Date()
        }
      })
    })

    this.generationEvents.publishTaskEvent('task.succeeded', {
      taskId: message.taskId,
      status: 'succeeded',
      stage: 'completed'
    })

    this.logger.log(`Marked generation task ${message.taskId} as succeeded`)
  }

  private async markFailed(message: GenerationResultMessage) {
    await this.prisma.$transaction(async (tx) => {
      const task = await tx.generationTask.findUnique({
        where: { id: message.taskId },
        select: {
          status: true,
          currentAttemptId: true
        }
      })

      if (!task || task.status === 'succeeded' || task.status === 'final_failed') {
        return
      }

      if (task.currentAttemptId !== message.attemptId) {
        return
      }

      await tx.generationTaskAttempt.update({
        where: { id: message.attemptId },
        data: {
          status: 'failed',
          failureCode: 'PROVIDER_FAILED',
          retryable: message.error?.retryable ?? true,
          rawError: message.error ?? undefined,
          endedAt: new Date()
        }
      })

      await tx.generationTask.update({
        where: { id: message.taskId },
        data: {
          status: 'failed',
          failureCode: 'PROVIDER_FAILED'
        }
      })
    })

    this.generationEvents.publishTaskEvent('task.failed', {
      taskId: message.taskId,
      status: 'failed',
      stage: 'completed',
      failureCode: 'PROVIDER_FAILED'
    })

    this.logger.log(`Marked generation task ${message.taskId} as failed`)
  }
}
