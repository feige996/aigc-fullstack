-- CreateTable
CREATE TABLE `generation_tasks` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `project_id` VARCHAR(191) NULL,
    `type` VARCHAR(191) NOT NULL,
    `model` VARCHAR(191) NOT NULL,
    `status` ENUM('draft', 'validating', 'rejected', 'pending', 'queued', 'running', 'retrying', 'succeeded', 'failed', 'final_failed', 'canceled', 'expired') NOT NULL,
    `stage` ENUM('input_validation', 'text_moderation', 'asset_moderation', 'quota_check', 'billing_freeze', 'queue_publish', 'model_dispatch', 'model_waiting', 'model_generating', 'result_fetching', 'media_processing', 'result_moderation', 'asset_uploading', 'billing_confirm', 'completed') NOT NULL,
    `failure_code` ENUM('INPUT_INVALID', 'PROMPT_SENSITIVE', 'TEXT_MODERATION_REJECTED', 'ASSET_MODERATION_REJECTED', 'RESULT_MODERATION_REJECTED', 'QUOTA_NOT_ENOUGH', 'BILLING_FREEZE_FAILED', 'QUEUE_PUBLISH_FAILED', 'WORKER_TIMEOUT', 'PROVIDER_TIMEOUT', 'PROVIDER_RATE_LIMITED', 'PROVIDER_REJECTED', 'PROVIDER_FAILED', 'MEDIA_PROCESS_FAILED', 'ASSET_UPLOAD_FAILED', 'CALLBACK_FAILED', 'BILLING_CONFIRM_FAILED', 'USER_CANCELED', 'SYSTEM_CANCELED', 'UNKNOWN_ERROR') NULL,
    `billing_status` ENUM('none', 'freezing', 'frozen', 'freeze_failed', 'confirming', 'confirmed', 'releasing', 'released', 'refunding', 'refunded', 'adjust_required') NOT NULL,
    `current_attempt_id` VARCHAR(191) NULL,
    `max_attempts` INTEGER NOT NULL DEFAULT 3,
    `request_payload` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `completed_at` DATETIME(3) NULL,

    UNIQUE INDEX `generation_tasks_current_attempt_id_key`(`current_attempt_id`),
    INDEX `generation_tasks_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `generation_tasks_status_created_at_idx`(`status`, `created_at`),
    INDEX `generation_tasks_model_created_at_idx`(`model`, `created_at`),
    INDEX `generation_tasks_failure_code_created_at_idx`(`failure_code`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `generation_task_attempts` (
    `id` VARCHAR(191) NOT NULL,
    `task_id` VARCHAR(191) NOT NULL,
    `attempt_no` INTEGER NOT NULL,
    `status` ENUM('pending', 'queued', 'running', 'succeeded', 'failed', 'canceled') NOT NULL,
    `stage` ENUM('input_validation', 'text_moderation', 'asset_moderation', 'quota_check', 'billing_freeze', 'queue_publish', 'model_dispatch', 'model_waiting', 'model_generating', 'result_fetching', 'media_processing', 'result_moderation', 'asset_uploading', 'billing_confirm', 'completed') NOT NULL,
    `provider` VARCHAR(191) NULL,
    `provider_task_id` VARCHAR(191) NULL,
    `failure_code` ENUM('INPUT_INVALID', 'PROMPT_SENSITIVE', 'TEXT_MODERATION_REJECTED', 'ASSET_MODERATION_REJECTED', 'RESULT_MODERATION_REJECTED', 'QUOTA_NOT_ENOUGH', 'BILLING_FREEZE_FAILED', 'QUEUE_PUBLISH_FAILED', 'WORKER_TIMEOUT', 'PROVIDER_TIMEOUT', 'PROVIDER_RATE_LIMITED', 'PROVIDER_REJECTED', 'PROVIDER_FAILED', 'MEDIA_PROCESS_FAILED', 'ASSET_UPLOAD_FAILED', 'CALLBACK_FAILED', 'BILLING_CONFIRM_FAILED', 'USER_CANCELED', 'SYSTEM_CANCELED', 'UNKNOWN_ERROR') NULL,
    `retryable` BOOLEAN NOT NULL DEFAULT true,
    `idempotency_key` VARCHAR(191) NOT NULL,
    `request_payload_hash` VARCHAR(191) NOT NULL,
    `raw_error` JSON NULL,
    `started_at` DATETIME(3) NULL,
    `ended_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `generation_task_attempts_idempotency_key_key`(`idempotency_key`),
    INDEX `generation_task_attempts_task_id_status_idx`(`task_id`, `status`),
    INDEX `generation_task_attempts_provider_provider_task_id_idx`(`provider`, `provider_task_id`),
    INDEX `generation_task_attempts_failure_code_created_at_idx`(`failure_code`, `created_at`),
    UNIQUE INDEX `generation_task_attempts_task_id_attempt_no_key`(`task_id`, `attempt_no`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `generation_tasks` ADD CONSTRAINT `generation_tasks_current_attempt_id_fkey` FOREIGN KEY (`current_attempt_id`) REFERENCES `generation_task_attempts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `generation_task_attempts` ADD CONSTRAINT `generation_task_attempts_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `generation_tasks`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

