// Resumen para el panel de inicio.
const express = require('express');
const connection = require('../connection');

const router = express.Router();

router.get('/details', async (req, res, next) => {
  try {
    const [r] = await connection.consulta(`
      SELECT
        (SELECT COUNT(*) FROM user) AS usuarios,
        (SELECT COUNT(*) FROM club) AS club,
        (SELECT COUNT(*) FROM jugador) AS jugador,
        (SELECT COUNT(*) FROM campeonato) AS campeonatos,
        (SELECT COUNT(*) FROM campeonato WHERE status='true') AS campeonatos_activos,
        (SELECT COUNT(*) FROM equipo WHERE COALESCE(estado,'aprobado')='pendiente') AS equipos_pendientes,
        (SELECT COUNT(*) FROM user WHERE status='false') AS usuarios_pendientes,
        (SELECT COUNT(*) FROM partido WHERE estado='En vivo') AS partidos_en_vivo,
        (SELECT COUNT(*) FROM partido WHERE estado='Cerrado') AS partidos_jugados`);
    // "bill" se conserva por compatibilidad con el panel anterior
    res.status(200).json({ ...r, bill: r.campeonatos });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
