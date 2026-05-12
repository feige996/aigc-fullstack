import type { CreateGenerationTaskDto } from './dto/create-generation-task.dto'
import type { AuthenticatedUser } from '../auth/auth.types'

export interface CreateTaskInput {
  userId: string
  dto: CreateGenerationTaskDto
}

export interface UserScopedInput {
  user: AuthenticatedUser
}

export interface GetTaskInput extends UserScopedInput {
  taskId: string
}

export interface GetExecutionStateInput {
  taskId: string
  attemptId: string
}

export interface GenerationRequestPayload {
  clientRequestId?: string
  projectId?: string
  type: string
  model: string
  prompt: string
  ratio?: string
  duration?: number
  referenceAssetIds: string[]
}

export interface GenerationTaskRecord {
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
  assets?: unknown[]
}

export interface PublishAttemptInput {
  userId: string
  taskId: string
  requestPayload: GenerationRequestPayload
  attempt?: {
    id: string
    attemptNo: number
    idempotencyKey: string
  } | null
}
