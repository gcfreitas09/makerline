-- Makerline / UGC Quest - tabela de usuários (MySQL)
-- Charset recomendado: utf8mb4

CREATE TABLE IF NOT EXISTS `ugc_users` (
  `id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `email` VARCHAR(190) NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `createdAt` VARCHAR(40) NOT NULL,

  `weeklySummary` TINYINT(1) NOT NULL DEFAULT 0,

  `accessCount` INT NOT NULL DEFAULT 0,
  `timeSpentSeconds` INT NOT NULL DEFAULT 0,

  `lastLoginAt` VARCHAR(40) NULL,
  `lastSeenAt` VARCHAR(40) NULL,
  `lastAccessAt` VARCHAR(40) NULL,

  `sessionTokenHash` CHAR(64) NULL,
  `sessionTokenExpires` INT NULL,

  `resetTokenHash` CHAR(64) NULL,
  `resetTokenExpires` INT NULL,

  `resetCodeHash` CHAR(64) NULL,
  `resetCodeExpires` INT NULL,

  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

