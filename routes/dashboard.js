// Resumen para el panel de inicio, según el rol.
const express = require('express');
const connection = require('../connection');

const router = express.Router();

router.get('/details', async (req, res, next) => {
  try {
    const db = connection.consulta;
    const [r] = await db(`
      SELECT
        (SELECT COUNT(*) FROM user) AS usuarios,
        (SELECT COUNT(*) FROM club) AS club,
        (SELECT COUNT(*) FROM jugador) AS jugador,
        (SELECT COUNT(*) FROM campeonato) AS campeonatos,
        (SELECT COUNT(*) FROM campeonato WHERE status='true') AS campeonatos_activos,
        (SELECT COUNT(*) FROM user WHERE status='false') AS usuarios_pendientes,
        (SELECT COUNT(*) FROM equipo WHERE estado='solicitado') AS equipos_pendientes,
        (SELECT COUNT(*) FROM jugador_solicitud WHERE estado='pendiente') AS jugadores_pendientes,
        (SELECT COUNT(*) FROM pase_jugador WHERE estado='aceptado_origen') AS pases_pendientes,
        (SELECT COUNT(*) FROM partido WHERE estado='En vivo') AS partidos_en_vivo,
        (SELECT COUNT(*) FROM partido WHERE estado='Cerrado') AS partidos_jugados`);
    const datos = { ...r, bill: r.campeonatos };

    // Delegado: avisos de su club
    if (req.usuario && req.usuario.role === 'delegado') {
      const club = req.usuario.id_club || 0;
      const [d] = await db(`
        SELECT
          (SELECT COUNT(*) FROM jugador WHERE clubId=?) AS mis_jugadores,
          (SELECT COUNT(*) FROM jugador_solicitud WHERE id_club=? AND estado='observado') AS mis_solicitudes_observadas,
          (SELECT COUNT(*) FROM jugador_solicitud WHERE id_club=? AND estado='pendiente') AS mis_solicitudes_pendientes,
          (SELECT COUNT(*) FROM equipo WHERE id_club=? AND estado='observado') AS mis_equipos_observados,
          (SELECT COUNT(*) FROM pase_jugador WHERE id_club_solicitado=? AND estado='solicitado') AS pases_por_responder,
          (SELECT gestion FROM user WHERE id=?) AS gestion`,
        [club, club, club, club, club, req.usuario.id]);
      Object.assign(datos, d);
    }
    res.status(200).json(datos);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
