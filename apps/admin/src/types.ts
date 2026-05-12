export type TaskStatus =
  | 'draft'
  | 'validating'
  | 'rejected'
  | 'pending'
  | 'queued'
  | 'running'
  | 'retrying'
  | 'succeeded'
  | 'failed'
  | 'final_failed'
  | 'canceled'
  | 'expired'

export type UserRole = 'user' | 'admin' | 'super_admin'
export type UserStatus = 'active' | 'disabled'
export type ActiveView = 'tasks' | 'users' | 'projects'

export interface GenerationAttempt {
  id: string
  attemptNo: number
  status: string
  stage: string
  failureCode: string | null
  idempotencyKey: string
  createdAt: string
  updatedAt: string
  endedAt: string | null
}

export interface GenerationTask {
  taskId: string
  userId: string
  type: string
  model: string
  status: TaskStatus
  stage: string
  failureCode: string | null
  billingStatus: string
  currentAttemptId: string | null
  requestPayload: {
    prompt?: string
    ratio?: string
  }
  currentAttempt?: GenerationAttempt
  attempts?: GenerationAttempt[]
  createdAt: string
  updatedAt: string
  completedAt: string | null
}

export interface AuthResponse {
  accessToken: string
  refreshToken: string
  tokenType: string
  user: {
    id: string
    phoneNumber: string
    role: string
    status: string
  }
}

export interface StoredAuth {
  accessToken: string
  refreshToken: string
}

export interface AdminUser {
  id: string
  phoneNumber: string
  displayName: string | null
  role: UserRole
  status: UserStatus
  createdAt: string
  updatedAt: string
}

export interface Project {
  projectId: string
  userId: string
  name: string
  description: string | null
  status: string
  taskCount?: number
  user?: {
    id: string
    phoneNumber: string
    displayName: string | null
  }
  createdAt: string
  updatedAt: string
}
