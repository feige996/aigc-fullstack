import { Injectable } from '@nestjs/common'
import { createHash, randomUUID } from 'node:crypto'
import { PrismaService } from '../prisma/prisma.service'
import { CreateGenerationTaskDto } from './dto/create-generation-task.dto'

interface CreateTaskInput {
  userId: string
  dto: CreateGenerationTaskDto
}

@Injectable()
export class GenerationService {
  constructor(private readonly prisma: PrismaService) {}

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

    return {
      taskId: task.id,
      attemptId: task.currentAttempt?.id,
      status: task.status,
      stage: task.stage,
      billingStatus: task.billingStatus
    }
  }
}
