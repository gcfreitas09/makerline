-- Makerline / UGC Quest - tabela de usuários (MySQL)
-- Charset recomendado: utf8mb4

CREATE TABLE IF NOT EXISTS `ugc_users` (
  `id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `email` VARCHAR(190) NOT NULL,
  `instagram` VARCHAR(40) NULL,
  `referralCode` VARCHAR(80) NULL,
  `referredBy` VARCHAR(80) NULL,
  `password` VARCHAR(255) NOT NULL,
  `createdAt` VARCHAR(40) NOT NULL,

  `weeklySummary` TINYINT(1) NOT NULL DEFAULT 0,

  `accessCount` INT NOT NULL DEFAULT 0,
  `timeSpentSeconds` INT NOT NULL DEFAULT 0,

  `lastLoginAt` VARCHAR(40) NULL,
  `lastSeenAt` VARCHAR(40) NULL,
  `lastAccessAt` VARCHAR(40) NULL,

  `stripeCustomerId` VARCHAR(255) NULL,
  `stripeSubscriptionId` VARCHAR(255) NULL,
  `stripePriceId` VARCHAR(255) NULL,
  `stripeProductId` VARCHAR(255) NULL,
  `billingStatus` VARCHAR(40) NULL,
  `billingInterval` VARCHAR(20) NULL,
  `billingCurrentPeriodEnd` VARCHAR(40) NULL,
  `billingCancelAtPeriodEnd` TINYINT(1) NOT NULL DEFAULT 0,
  `billingLastEventId` VARCHAR(255) NULL,
  `billingLastSyncedAt` VARCHAR(40) NULL,

  `cpfHash` CHAR(64) NULL,
  `cpfLast4` VARCHAR(4) NULL,
  `trialStartedAt` VARCHAR(40) NULL,
  `trialEndsAt` VARCHAR(40) NULL,

  `sessionTokenHash` CHAR(64) NULL,
  `sessionTokenExpires` INT NULL,

  `resetTokenHash` CHAR(64) NULL,
  `resetTokenExpires` INT NULL,

  `resetCodeHash` CHAR(64) NULL,
  `resetCodeExpires` INT NULL,

  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_email` (`email`),
  UNIQUE KEY `uniq_instagram` (`instagram`),
  UNIQUE KEY `uniq_cpf_hash` (`cpfHash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `ugc_users`
  ADD COLUMN IF NOT EXISTS `instagram` VARCHAR(40) NULL AFTER `email`,
  ADD COLUMN IF NOT EXISTS `referralCode` VARCHAR(80) NULL AFTER `email`,
  ADD COLUMN IF NOT EXISTS `referredBy` VARCHAR(80) NULL AFTER `referralCode`,
  ADD COLUMN IF NOT EXISTS `stripeCustomerId` VARCHAR(255) NULL AFTER `lastAccessAt`,
  ADD COLUMN IF NOT EXISTS `stripeSubscriptionId` VARCHAR(255) NULL AFTER `stripeCustomerId`,
  ADD COLUMN IF NOT EXISTS `stripePriceId` VARCHAR(255) NULL AFTER `stripeSubscriptionId`,
  ADD COLUMN IF NOT EXISTS `stripeProductId` VARCHAR(255) NULL AFTER `stripePriceId`,
  ADD COLUMN IF NOT EXISTS `billingStatus` VARCHAR(40) NULL AFTER `stripeProductId`,
  ADD COLUMN IF NOT EXISTS `billingInterval` VARCHAR(20) NULL AFTER `billingStatus`,
  ADD COLUMN IF NOT EXISTS `billingCurrentPeriodEnd` VARCHAR(40) NULL AFTER `billingInterval`,
  ADD COLUMN IF NOT EXISTS `billingCancelAtPeriodEnd` TINYINT(1) NOT NULL DEFAULT 0 AFTER `billingCurrentPeriodEnd`,
  ADD COLUMN IF NOT EXISTS `billingLastEventId` VARCHAR(255) NULL AFTER `billingCancelAtPeriodEnd`,
  ADD COLUMN IF NOT EXISTS `billingLastSyncedAt` VARCHAR(40) NULL AFTER `billingLastEventId`,
  ADD COLUMN IF NOT EXISTS `cpfHash` CHAR(64) NULL AFTER `billingLastSyncedAt`,
  ADD COLUMN IF NOT EXISTS `cpfLast4` VARCHAR(4) NULL AFTER `cpfHash`,
  ADD COLUMN IF NOT EXISTS `trialStartedAt` VARCHAR(40) NULL AFTER `cpfLast4`,
  ADD COLUMN IF NOT EXISTS `trialEndsAt` VARCHAR(40) NULL AFTER `trialStartedAt`;

-- Para bancos existentes, crie um índice único em cpfHash pelo painel do banco se sua versão do MySQL/MariaDB não aceitar IF NOT EXISTS em índices.
