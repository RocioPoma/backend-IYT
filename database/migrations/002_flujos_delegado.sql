-- Migración 002: flujos de aprobación del delegado.
--  * Gestión asignada al delegado (solo inscribe equipos en los campeonatos de esa gestión)
--  * Inscripción de equipos: borrador → solicitado → aprobado / observado / rechazado (comité técnico)
--  * Solicitudes de alta y de actualización de jugadores (comité técnico acepta u observa)
--  * Pase de jugador en 3 pasos: el club destino solicita, el club de origen acepta, el comité técnico aprueba
-- Se ejecuta con:  npm run migrate   (los datos existentes se conservan)

-- ===== Gestión asignada al delegado =====
ALTER TABLE `user` ADD COLUMN `gestion` INT NULL;

-- ===== Inscripción de equipos =====
ALTER TABLE `equipo` ADD COLUMN `observacion` VARCHAR(500) NULL;
ALTER TABLE `equipo` ADD COLUMN `fecha_solicitud` DATETIME NULL;
ALTER TABLE `equipo` ADD COLUMN `fecha_revision` DATETIME NULL;
ALTER TABLE `equipo` ADD COLUMN `revisado_por` INT NULL;
-- "pendiente" (versión anterior) equivale a "solicitado"
UPDATE `equipo` SET `estado` = 'solicitado' WHERE `estado` = 'pendiente';

-- ===== Solicitudes de alta / actualización de jugadores =====
CREATE TABLE IF NOT EXISTS `jugador_solicitud` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tipo` VARCHAR(15) NOT NULL,                      -- alta | actualizacion
  `ci` VARCHAR(15) NOT NULL,
  `id_club` INT NOT NULL,
  `nombre` VARCHAR(255) NULL,
  `ap_paterno` VARCHAR(255) NULL,
  `ap_materno` VARCHAR(255) NULL,
  `fecha_nacimiento` DATE NULL,
  `sexo` VARCHAR(25) NULL,
  `decendencia` VARCHAR(50) NULL,
  `foto` VARCHAR(255) NULL,
  `documento` VARCHAR(255) NULL,
  `estado` VARCHAR(15) NOT NULL DEFAULT 'borrador', -- borrador | pendiente | aprobado | observado | anulado
  `observacion` VARCHAR(500) NULL,
  `solicitado_por` INT NULL,
  `revisado_por` INT NULL,
  `fecha_creacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_solicitud` DATETIME NULL,
  `fecha_revision` DATETIME NULL,
  PRIMARY KEY (`id`),
  KEY `idx_js_ci` (`ci`),
  KEY `idx_js_club_estado` (`id_club`, `estado`),
  KEY `idx_js_estado` (`estado`),
  CONSTRAINT `fk_js_club` FOREIGN KEY (`id_club`) REFERENCES `club` (`id`),
  CONSTRAINT `chk_js_tipo` CHECK (`tipo` IN ('alta', 'actualizacion')),
  CONSTRAINT `chk_js_estado` CHECK (`estado` IN ('borrador', 'pendiente', 'aprobado', 'observado', 'anulado'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ===== Pase de jugador en 3 pasos =====
ALTER TABLE `pase_jugador` MODIFY `documento` VARCHAR(255) NULL;
ALTER TABLE `pase_jugador` MODIFY `estado` VARCHAR(20) NULL;
ALTER TABLE `pase_jugador` ADD COLUMN `observacion` VARCHAR(500) NULL;
ALTER TABLE `pase_jugador` ADD COLUMN `solicitado_por` INT NULL;
ALTER TABLE `pase_jugador` ADD COLUMN `respondido_por` INT NULL;
ALTER TABLE `pase_jugador` ADD COLUMN `fecha_respuesta` DATETIME NULL;
ALTER TABLE `pase_jugador` ADD COLUMN `revisado_por` INT NULL;
ALTER TABLE `pase_jugador` ADD COLUMN `fecha_revision` DATETIME NULL;
ALTER TABLE `pase_jugador` ADD INDEX `idx_pase_estado` (`estado`);
-- Los pases registrados antes ya estaban aprobados
UPDATE `pase_jugador` SET `estado` = 'aprobado' WHERE `estado` IS NULL OR `estado` IN ('true', '');
