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

export interface CreateTaskResponse {
  taskId: string
  attemptId?: string
  traceId?: string
  status: TaskStatus
  stage: string
  failureCode?: string
  billingStatus: string
}

export interface GenerationTask {
  taskId: string
  projectId: string | null
  type: string
  model: string
  status: TaskStatus
  stage: string
  failureCode: string | null
  billingStatus: string
  requestPayload: {
    prompt?: string
    ratio?: string
    referenceAssetIds?: string[]
  }
  assets?: Asset[]
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

export interface Project {
  projectId: string
  userId: string
  name: string
  description: string | null
  status: string
  taskCount?: number
  createdAt: string
  updatedAt: string
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
  width?: number | null
  height?: number | null
  duration?: number | null
  createdAt: string
  updatedAt: string
}

export interface CreateAssetUploadResponse {
  asset: Asset
  upload: {
    method: 'PUT'
    url: string
    headers: Record<string, string>
    expiresInSeconds: number
  }
}
