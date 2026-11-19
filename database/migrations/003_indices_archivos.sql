-- Índices para que la verificación de documentos privados al entregar imágenes sea instantánea
ALTER TABLE `jugador` ADD INDEX `idx_jugador_documento` (`documento`);
ALTER TABLE `pase_jugador` ADD INDEX `idx_pase_documento` (`documento`);
ALTER TABLE `jugador_solicitud` ADD INDEX `idx_js_foto` (`foto`);
ALTER TABLE `jugador_solicitud` ADD INDEX `idx_js_documento` (`documento`);
