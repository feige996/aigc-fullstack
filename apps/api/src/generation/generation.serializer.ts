import type { Prisma } from '@prisma/client'
import { createHash } from 'node:crypto'
import type { AuthenticatedUser } from '../auth/auth.types'
import type {
  GenerationRequestPayload,
  TaskAttemptRecord,
  TaskAssetRecord,
  TaskRecord
} from './generation.types'

export function serializeTask(task: TaskRecord) {
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
    inputPayload: task.inputPayload,
    resultPayload: task.resultPayload,
    usagePayload: task.usagePayload,
    currentAttempt: task.currentAttempt ? serializeTaskAttempt(task.currentAttempt) : task.currentAttempt,
    attempts: task.attempts?.map((attempt) => serializeTaskAttempt(attempt)),
    assets: task.assets?.map((asset) => serializeGenerationAsset(asset)),
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    completedAt: task.completedAt?.toISOString() ?? null
  }
}

function serializeTaskAttempt(attempt: TaskAttemptRecord) {
  return {
    id: attempt.id,
    attemptId: attempt.id,
    taskId: attempt.taskId,
    attemptNo: attempt.attemptNo,
    status: attempt.status,
    stage: attempt.stage,
    provider: attempt.provider,
    providerTaskId: attempt.providerTaskId,
    failureCode: attempt.failureCode,
    retryable: attempt.retryable,
    idempotencyKey: attempt.idempotencyKey,
    inputPayloadHash: attempt.inputPayloadHash,
    rawError: attempt.rawError,
    startedAt: attempt.startedAt?.toISOString() ?? null,
    endedAt: attempt.endedAt?.toISOString() ?? null,
    createdAt: attempt.createdAt.toISOString(),
    updatedAt: attempt.updatedAt.toISOString()
  }
}

function serializeGenerationAsset(asset: TaskAssetRecord) {
  return {
    assetId: asset.id,
    userId: asset.userId,
    projectId: asset.projectId,
    taskId: asset.taskId,
    type: asset.type,
    status: asset.status,
    provider: asset.provider,
    bucket: asset.bucket,
    objectKey: asset.objectKey,
    mimeType: asset.mimeType,
    size: asset.size,
    checksum: asset.checksum,
    width: asset.width,
    height: asset.height,
    duration: asset.duration,
    expiresAt: asset.expiresAt?.toISOString() ?? null,
    deletedAt: asset.deletedAt?.toISOString() ?? null,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString()
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

export function toPrismaJson(payload: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(payload)) as Prisma.InputJsonValue
}
