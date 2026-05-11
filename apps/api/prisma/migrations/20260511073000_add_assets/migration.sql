CREATE TABLE `assets` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `project_id` VARCHAR(191) NULL,
    `task_id` VARCHAR(191) NULL,
    `type` ENUM('user_upload', 'model_input', 'model_output_raw', 'processed_output', 'preview', 'cover', 'watermarked', 'source', 'audit_sample', 'temp') NOT NULL,
    `status` ENUM('temporary', 'processing', 'active', 'blocked', 'deleted', 'expired', 'orphaned') NOT NULL DEFAULT 'temporary',
    `provider` VARCHAR(191) NOT NULL,
    `bucket` VARCHAR(191) NOT NULL,
    `object_key` VARCHAR(191) NOT NULL,
    `mime_type` VARCHAR(191) NOT NULL,
    `size` INTEGER NULL,
    `checksum` VARCHAR(191) NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `duration` INTEGER NULL,
    `expires_at` DATETIME(3) NULL,
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `assets_bucket_object_key_key`(`bucket`, `object_key`),
    INDEX `assets_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `assets_project_id_created_at_idx`(`project_id`, `created_at`),
    INDEX `assets_task_id_created_at_idx`(`task_id`, `created_at`),
    INDEX `assets_status_created_at_idx`(`status`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `assets` ADD CONSTRAINT `assets_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `assets` ADD CONSTRAINT `assets_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `assets` ADD CONSTRAINT `assets_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `generation_tasks`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
