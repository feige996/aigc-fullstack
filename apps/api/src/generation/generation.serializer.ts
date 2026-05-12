import type { Prisma } from '@prisma/client'
import { createHash } from 'node:crypto'
import type { AuthenticatedUser } from '../auth/auth.types'
import type { GenerationRequestPayload, GenerationTaskRecord } from './generation.types'

export function serializeGenerationTask(task: GenerationTaskRecord) {
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

export function taskAccessWhere(user: AuthenticatedUser) {
  if (user.role === 'admin' || user.role === 'super_admin') {
    return {}
  }

  return {
    userId: user.id
  }
}

export function hashGenerationPayload(payload: GenerationRequestPayload) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}

export function toPrismaJson(payload: GenerationRequestPayload): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(payload)) as Prisma.InputJsonValue
}
