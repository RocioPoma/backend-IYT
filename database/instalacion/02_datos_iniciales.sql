-- Datos mínimos para empezar a usar el sistema en una instalación nueva.
USE `bdd_campeonatos_v02`;

-- Las migraciones ya están incluidas en 01_esquema.sql
INSERT IGNORE INTO schema_migrations (nombre) VALUES
  ('001_seguridad_y_requerimientos.sql'),
  ('002_flujos_delegado.sql');

-- Tiempos de juego
INSERT IGNORE INTO all_times (id_time, nombre) VALUES (1, 'Primer tiempo'), (2, 'Segundo tiempo'), (3, 'Tiempo extra'), (4, 'Penales');

-- Tipos de hecho de un partido (el 1 se usa por defecto en el ranking)
INSERT IGNORE INTO hechos_disciplinas (id_hecho, nombre) VALUES
  (1, 'Gol / Punto'), (2, 'Falta'), (3, 'Tarjeta amarilla'), (4, 'Tarjeta roja'), (5, 'Cambio');

-- Series
INSERT IGNORE INTO serie (id_serie, nombre, estado) VALUES (1, 'Serie A', 'true'), (2, 'Serie B', 'true');

-- Administrador inicial. Contraseña temporal: Cambiar123  (cámbiela al ingresar por primera vez).
-- La contraseña está cifrada con bcrypt.
INSERT INTO user (name, email, password, status, role, fecha_registro)
SELECT 'Administrador', 'admin@iyt.bo', '$2b$10$6RAr9crBQaJBvN7id6izp.VAVdm1kK5PtzLT2A.DclnKPK44lhgSW', 'true', 'admin', CURDATE()
WHERE NOT EXISTS (SELECT 1 FROM user WHERE email = 'admin@iyt.bo');
