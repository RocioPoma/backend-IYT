-- Comunidad y club anfitrión del campeonato, y su número en romanos (se usan en los carnets)
ALTER TABLE `campeonato` ADD COLUMN `comunidad_anfitriona` varchar(100) DEFAULT NULL;
ALTER TABLE `campeonato` ADD COLUMN `id_club_anfitrion` int DEFAULT NULL;
ALTER TABLE `campeonato` ADD COLUMN `numero_romano` varchar(20) DEFAULT NULL;
ALTER TABLE `campeonato` ADD CONSTRAINT `fk_campeonato_club_anfitrion` FOREIGN KEY (`id_club_anfitrion`) REFERENCES `club` (`id`) ON DELETE SET NULL;
