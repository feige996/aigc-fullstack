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
export type ActiveView = 'tasks' | 'users' | 'projects' | 'account'

export interface ListResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

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

export interface Task {
  taskId: string
  userId: string
  type: string
  model: string
  status: TaskStatus
  stage: string
  failureCode: string | null
  billingStatus: string
  currentAttemptId: string | null
  resultPayload?: unknown | null
  usagePayload?: unknown | null
  inputPayload: {
    prompt?: string
    ratio?: string
  }
  currentAttempt?: GenerationAttempt
  attempts?: GenerationAttempt[]
  assets?: Asset[]
  createdAt: string
  updatedAt: string
  completedAt: string | null
}

export interface Asset {
  assetId: string
  userId: string
  projectId: string | null
  taskId: string | null
  type: string
  status: string
  provider: string
  bucket: string
  objectKey: string
  mimeType: string
  size: number | null
  width: number | null
  height: number | null
  duration: number | null
  createdAt: string
  updatedAt: string
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
