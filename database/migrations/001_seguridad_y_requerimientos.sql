-- Migración 001: seguridad, requerimientos faltantes y correcciones de tipos.
-- Se ejecuta con:  npm run migrate
-- Es segura de re-ejecutar: si una columna/índice ya existe, se omite.

-- ===== Usuarios (RF02, req. 3.3.2) =====
ALTER TABLE `user` MODIFY `password` VARCHAR(255) NULL;
ALTER TABLE `user` MODIFY `email` VARCHAR(100) NULL;
ALTER TABLE `user` ADD COLUMN `reset_token` CHAR(64) NULL;
ALTER TABLE `user` ADD COLUMN `reset_expira` DATETIME NULL;
ALTER TABLE `user` ADD INDEX `idx_user_email` (`email`);
-- Rol antiguo "user" pasa a "delegado" (roles del documento: admin, presidente, comite_tecnico, responsable_categoria, delegado)
UPDATE `user` SET `role` = 'delegado' WHERE `role` = 'user' OR `role` IS NULL;

-- ===== Noticias: fecha y hora de registro (RF05.9.3) =====
ALTER TABLE `noticia` ADD COLUMN `fecha_registro` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE `noticia` MODIFY `descripcion` TEXT NULL;

-- ===== Partidos: árbitro, jornada e índices (RF05.9.2.8.2.4) =====
ALTER TABLE `partido` ADD COLUMN `id_arbitro` VARCHAR(15) NULL;
ALTER TABLE `partido` ADD COLUMN `ronda` INT NULL;
ALTER TABLE `partido` ADD INDEX `idx_partido_categoria` (`id_contempla`, `id_serie`);
ALTER TABLE `partido` ADD INDEX `idx_partido_fecha` (`fecha`, `hora`);
UPDATE `partido` SET `estado` = 'No realizado' WHERE `estado` IS NULL OR `estado` = '';

-- ===== Equipos: aprobación por el administrador (req. 3.3.2) =====
ALTER TABLE `equipo` ADD COLUMN `estado` VARCHAR(15) NOT NULL DEFAULT 'aprobado';

-- ===== Campos de juego (RF10) =====
ALTER TABLE `cancha` ADD COLUMN `tipo` VARCHAR(50) NULL;
ALTER TABLE `cancha` ADD COLUMN `estado` VARCHAR(10) NOT NULL DEFAULT 'true';

-- ===== Correcciones de tipos =====
-- El CI del jugador es texto en la tabla jugador pero era número en pase_jugador
ALTER TABLE `pase_jugador` MODIFY `ci` VARCHAR(15) NOT NULL;
ALTER TABLE `pase_jugador` ADD INDEX `idx_pase_ci` (`ci`);
ALTER TABLE `arbitro` MODIFY `telefono` VARCHAR(20) NULL;

-- ===== Índices para que las consultas frecuentes sean rápidas =====
ALTER TABLE `jugador` ADD INDEX `idx_jugador_club` (`clubId`);
ALTER TABLE `hechos_partido` ADD INDEX `idx_hechos_partido` (`id_partido`);
ALTER TABLE `hechos_partido` ADD INDEX `idx_hechos_ranking` (`id_contempla`, `id_hecho`);
ALTER TABLE `equipo_jugador` ADD INDEX `idx_ej_categoria` (`id_contempla`, `ci`);
ALTER TABLE `equipo` ADD INDEX `idx_equipo_categoria` (`id_contempla`);

-- ===== Medallero (RF05.9.2.8.5) =====
CREATE TABLE IF NOT EXISTS `medallero` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `id_contempla` INT NOT NULL,
  `puesto` TINYINT NOT NULL,
  `id_club` INT NOT NULL,
  `fecha_registro` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_medallero_puesto` (`id_contempla`, `puesto`),
  KEY `idx_medallero_club` (`id_club`),
  CONSTRAINT `fk_medallero_contempla` FOREIGN KEY (`id_contempla`) REFERENCES `contempla` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_medallero_club` FOREIGN KEY (`id_club`) REFERENCES `club` (`id`),
  CONSTRAINT `chk_medallero_puesto` CHECK (`puesto` BETWEEN 1 AND 3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
