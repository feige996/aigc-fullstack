-- CreateTable
CREATE TABLE `tasks` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `project_id` VARCHAR(191) NULL,
    `type` VARCHAR(191) NOT NULL,
    `model` VARCHAR(191) NOT NULL,
    `status` ENUM('draft', 'validating', 'rejected', 'pending', 'queued', 'running', 'retrying', 'succeeded', 'failed', 'final_failed', 'canceled', 'expired') NOT NULL,
    `stage` VARCHAR(191) NOT NULL,
    `failure_code` ENUM('INPUT_INVALID', 'PROMPT_SENSITIVE', 'TEXT_MODERATION_REJECTED', 'ASSET_MODERATION_REJECTED', 'RESULT_MODERATION_REJECTED', 'QUOTA_NOT_ENOUGH', 'BILLING_FREEZE_FAILED', 'QUEUE_PUBLISH_FAILED', 'WORKER_TIMEOUT', 'PROVIDER_TIMEOUT', 'PROVIDER_RATE_LIMITED', 'PROVIDER_REJECTED', 'PROVIDER_FAILED', 'MEDIA_PROCESS_FAILED', 'ASSET_UPLOAD_FAILED', 'CALLBACK_FAILED', 'BILLING_CONFIRM_FAILED', 'USER_CANCELED', 'SYSTEM_CANCELED', 'UNKNOWN_ERROR') NULL,
    `billing_status` ENUM('none', 'freezing', 'frozen', 'freeze_failed', 'confirming', 'confirmed', 'releasing', 'released', 'refunding', 'refunded', 'adjust_required') NOT NULL,
    `current_attempt_id` VARCHAR(191) NULL,
    `max_attempts` INTEGER NOT NULL DEFAULT 3,
    `input_payload` JSON NOT NULL,
    `result_payload` JSON NULL,
    `usage_payload` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `completed_at` DATETIME(3) NULL,

    UNIQUE INDEX `tasks_current_attempt_id_key`(`current_attempt_id`),
    INDEX `tasks_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `tasks_status_created_at_idx`(`status`, `created_at`),
    INDEX `tasks_model_created_at_idx`(`model`, `created_at`),
    INDEX `tasks_failure_code_created_at_idx`(`failure_code`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `task_attempts` (
    `id` VARCHAR(191) NOT NULL,
    `task_id` VARCHAR(191) NOT NULL,
    `attempt_no` INTEGER NOT NULL,
    `status` ENUM('pending', 'queued', 'running', 'succeeded', 'failed', 'canceled') NOT NULL,
    `stage` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NULL,
    `provider_task_id` VARCHAR(191) NULL,
    `failure_code` ENUM('INPUT_INVALID', 'PROMPT_SENSITIVE', 'TEXT_MODERATION_REJECTED', 'ASSET_MODERATION_REJECTED', 'RESULT_MODERATION_REJECTED', 'QUOTA_NOT_ENOUGH', 'BILLING_FREEZE_FAILED', 'QUEUE_PUBLISH_FAILED', 'WORKER_TIMEOUT', 'PROVIDER_TIMEOUT', 'PROVIDER_RATE_LIMITED', 'PROVIDER_REJECTED', 'PROVIDER_FAILED', 'MEDIA_PROCESS_FAILED', 'ASSET_UPLOAD_FAILED', 'CALLBACK_FAILED', 'BILLING_CONFIRM_FAILED', 'USER_CANCELED', 'SYSTEM_CANCELED', 'UNKNOWN_ERROR') NULL,
    `retryable` BOOLEAN NOT NULL DEFAULT true,
    `idempotency_key` VARCHAR(191) NOT NULL,
    `input_payload_hash` VARCHAR(191) NOT NULL,
    `raw_error` JSON NULL,
    `started_at` DATETIME(3) NULL,
    `ended_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `task_attempts_idempotency_key_key`(`idempotency_key`),
    INDEX `task_attempts_task_id_status_idx`(`task_id`, `status`),
    INDEX `task_attempts_provider_provider_task_id_idx`(`provider`, `provider_task_id`),
    INDEX `task_attempts_failure_code_created_at_idx`(`failure_code`, `created_at`),
    UNIQUE INDEX `task_attempts_task_id_attempt_no_key`(`task_id`, `attempt_no`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_current_attempt_id_fkey` FOREIGN KEY (`current_attempt_id`) REFERENCES `task_attempts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_attempts` ADD CONSTRAINT `task_attempts_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
