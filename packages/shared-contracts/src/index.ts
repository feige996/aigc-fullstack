export const generationTaskStatuses = [
  'draft',
  'validating',
  'rejected',
  'pending',
  'queued',
  'running',
  'retrying',
  'succeeded',
  'failed',
  'final_failed',
  'canceled',
  'expired',
] as const;

export type GenerationTaskStatus = (typeof generationTaskStatuses)[number];

export const generationTaskStages = [
  'input_validation',
  'text_moderation',
  'asset_moderation',
  'quota_check',
  'billing_freeze',
  'queue_publish',
  'model_dispatch',
  'model_waiting',
  'model_generating',
  'result_fetching',
  'media_processing',
  'result_moderation',
  'asset_uploading',
  'billing_confirm',
  'completed',
] as const;

export type GenerationTaskStage = (typeof generationTaskStages)[number];

export const billingStatuses = [
  'none',
  'freezing',
  'frozen',
  'freeze_failed',
  'confirming',
  'confirmed',
  'releasing',
  'released',
  'refunding',
  'refunded',
  'adjust_required',
] as const;

export type BillingStatus = (typeof billingStatuses)[number];

export const assetStatuses = [
  'temporary',
  'processing',
  'active',
  'blocked',
  'deleted',
  'expired',
  'orphaned',
] as const;

export type AssetStatus = (typeof assetStatuses)[number];

export const assetTypes = [
  'user_upload',
  'model_input',
  'model_output_raw',
  'processed_output',
  'preview',
  'cover',
  'watermarked',
  'source',
  'audit_sample',
  'temp',
] as const;

export type AssetType = (typeof assetTypes)[number];

export const moderationStatuses = ['pending', 'passed', 'rejected', 'manual_review'] as const;

export type ModerationStatus = (typeof moderationStatuses)[number];

export const failureCodes = [
  'INPUT_INVALID',
  'PROMPT_SENSITIVE',
  'TEXT_MODERATION_REJECTED',
  'ASSET_MODERATION_REJECTED',
  'RESULT_MODERATION_REJECTED',
  'QUOTA_NOT_ENOUGH',
  'BILLING_FREEZE_FAILED',
  'QUEUE_PUBLISH_FAILED',
  'WORKER_TIMEOUT',
  'PROVIDER_TIMEOUT',
  'PROVIDER_RATE_LIMITED',
  'PROVIDER_REJECTED',
  'PROVIDER_FAILED',
  'MEDIA_PROCESS_FAILED',
  'ASSET_UPLOAD_FAILED',
  'CALLBACK_FAILED',
  'BILLING_CONFIRM_FAILED',
  'USER_CANCELED',
  'SYSTEM_CANCELED',
  'UNKNOWN_ERROR',
] as const;

export type FailureCode = (typeof failureCodes)[number];

export const taskDomains = [
  'default',
  'aigc_generation',
  'novel_analysis',
  'document_analysis',
] as const;

export type TaskDomain = (typeof taskDomains)[number];

export const taskTypes = [
  'generic_task',
  'text_to_image',
  'image_to_image',
  'image_upscale',
  'video_generation',
  'novel_profile_analysis',
  'document_summary',
  'document_risk_analysis',
] as const;

export type TaskType = (typeof taskTypes)[number];

export const providerCapabilities = [
  'generic_execution',
  'image_generation',
  'video_generation',
  'image_processing',
  'text_analysis',
  'document_parsing',
  'relationship_extraction',
  'payment',
  'notification',
  'search',
] as const;

export type ProviderCapability = (typeof providerCapabilities)[number];

export const rabbitExchanges = {
  generationRequest: 'generation.request',
  generationResult: 'generation.result',
  generationDeadLetter: 'generation.dead-letter',
} as const;

export const rabbitRoutingKeys = {
  imageGenerate: 'image.generate',
  videoGenerate: 'video.generate',
  imageUpscale: 'image.upscale',
  imageInpaint: 'image.inpaint',
  taskSucceeded: 'task.succeeded',
  taskFailed: 'task.failed',
  taskProgress: 'task.progress',
} as const;

export const rabbitQueues = {
  imageGenerate: 'image.generate.queue',
  videoGenerate: 'video.generate.queue',
  imageUpscale: 'image.upscale.queue',
  imageInpaint: 'image.inpaint.queue',
  generationResultPersist: 'generation.result.persist.queue',
  generationFailed: 'generation.failed.queue',
} as const;

export interface GenerationRequestMessage {
  traceId: string;
  taskId: string;
  attemptId: string;
  userId: string;
  type: string;
  model: string;
  input: {
    prompt: string;
    ratio?: string;
    duration?: number;
    referenceAssetIds: string[];
  };
  idempotencyKey: string;
  attempt: number;
}

export interface GenerationResultMessage {
  traceId: string;
  taskId: string;
  attemptId: string;
  status: 'succeeded' | 'failed';
  provider: string;
  outputs: Array<{
    type: 'image' | 'video';
    objectPath: string;
    previewUrl?: string;
    width?: number;
    height?: number;
    duration?: number;
  }>;
  usage?: {
    cost: number;
    unit: 'credits' | 'money';
  };
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  } | null;
}

export const sseEvents = {
  taskQueued: 'task.queued',
  taskRunning: 'task.running',
  taskProgress: 'task.progress',
  taskSucceeded: 'task.succeeded',
  taskFailed: 'task.failed',
  taskCanceled: 'task.canceled',
  quotaUpdated: 'quota.updated',
} as const;
