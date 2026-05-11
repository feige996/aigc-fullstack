-- Simplify the first-stage account model to mainland China phone numbers only.
ALTER TABLE `users` DROP INDEX `users_phone_country_code_phone_number_key`;
ALTER TABLE `users` DROP COLUMN `phone_country_code`;
CREATE UNIQUE INDEX `users_phone_number_key` ON `users`(`phone_number`);
