-- Add phone fields in a data-compatible way for existing local users.
ALTER TABLE `users` ADD COLUMN `phone_country_code` VARCHAR(191) NOT NULL DEFAULT '+86';
ALTER TABLE `users` ADD COLUMN `phone_number` VARCHAR(191) NULL;

SET @aigc_phone_row_number = 0;
UPDATE `users`
SET `phone_number` = CONCAT('199', LPAD((@aigc_phone_row_number := @aigc_phone_row_number + 1), 8, '0'))
WHERE `phone_number` IS NULL
ORDER BY `created_at`, `id`;

ALTER TABLE `users` MODIFY `phone_number` VARCHAR(191) NOT NULL;
ALTER TABLE `users` MODIFY `email` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `users_phone_country_code_phone_number_key` ON `users`(`phone_country_code`, `phone_number`);
