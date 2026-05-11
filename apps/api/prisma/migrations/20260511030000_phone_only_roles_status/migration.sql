-- Move to a phone-only account model and add account status.
ALTER TABLE `users` DROP INDEX `users_email_key`;
ALTER TABLE `users` DROP COLUMN `email`;

ALTER TABLE `users` MODIFY `role` ENUM('user', 'admin', 'super_admin') NOT NULL DEFAULT 'user';

ALTER TABLE `users` ADD COLUMN `status` ENUM('active', 'disabled') NOT NULL DEFAULT 'active';
CREATE INDEX `users_status_created_at_idx` ON `users`(`status`, `created_at`);

