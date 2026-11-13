// Equipos inscritos en una categoría de campeonato (RF05.9.2.8.1).
// Requisito 3.3.2: el registro de equipos debe ser aprobado por el administrador.
const express = require('express');
const connection = require('../connection');
const { ROLES, GRUPOS, requireRole } = require('../services/checkRole');
const { soloSuClub } = require('../services/club');

const router = express.Router();
const db = connection.consulta;
const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

//------------ LISTAR TODOS LOS EQUIPOS ------------
router.get('/get_all', h(async (req, res) => {
  const filas = await db(
    `SELECT e.*, COALESCE(e.estado,'aprobado') AS estado, b.nombre AS nombre_club
     FROM equipo e JOIN club b ON e.id_club = b.id ORDER BY b.nombre`
  );
  res.status(200).json(filas);
}));

//------------ LISTAR EQUIPOS DE UNA CATEGORÍA (RF05.9.2.8.1.1) — público ------------
router.get('/get/:id_contempla', h(async (req, res) => {
  const soloAprobados = !req.usuario;
  const filas = await db(
    `SELECT e.*, COALESCE(e.estado,'aprobado') AS estado, b.nombre AS nombre_club, b.comunidad, b.logo,
            (SELECT COUNT(*) FROM equipo_jugador ej WHERE ej.id_club=e.id_club AND ej.id_contempla=e.id_contempla) AS total_jugadores
     FROM equipo e JOIN club b ON e.id_club = b.id
     WHERE e.id_contempla=? ${soloAprobados ? "AND COALESCE(e.estado,'aprobado')='aprobado'" : ''}
     ORDER BY e.numero_sorteo, b.nombre`,
    [req.params.id_contempla]
  );
  res.status(200).json(filas);
}));

//------------ REGISTRAR EQUIPO (RF05.9.2.8.1.2) ------------
// Si lo inscribe un delegado queda "pendiente" hasta que lo apruebe el administrador o comité técnico.
router.post('/add', soloSuClub((req) => req.body && req.body.id_club), h(async (req, res) => {
  const e = req.body || {};
  if (!e.id_club || !e.id_contempla) return res.status(400).json({ message: 'Faltan el club o la categoría' });
  const categoria = await db("SELECT estado FROM contempla WHERE id=?", [e.id_contempla]);
  if (!categoria.length) return res.status(404).json({ message: 'Categoría no encontrada' });
  if (categoria[0].estado === 'false') return res.status(400).json({ message: 'La categoría está desactivada' });

  const estado = req.usuario.role === ROLES.DELEGADO ? 'pendiente' : 'aprobado';
  await db('INSERT INTO equipo SET ?', [{
    id_club: e.id_club,
    id_contempla: e.id_contempla,
    id_serie: e.id_serie === '' || e.id_serie == null ? 0 : e.id_serie,
    numero_sorteo: e.numero_sorteo === '' ? null : e.numero_sorteo ?? null,
    estado,
  }]);
  res.status(200).json({
    message: estado === 'pendiente' ? 'Equipo registrado. Queda pendiente de aprobación.' : 'Equipo agregado con exito',
  });
}));

//------------ APROBAR / RECHAZAR EQUIPO ------------
router.patch('/updateStatus', requireRole(GRUPOS.GESTION), h(async (req, res) => {
  const { id_club, id_contempla, estado } = req.body || {};
  if (!['aprobado', 'pendiente', 'rechazado'].includes(estado)) {
    return res.status(400).json({ message: 'Estado inválido (aprobado, pendiente o rechazado)' });
  }
  const r = await db('UPDATE equipo SET estado=? WHERE id_club=? AND id_contempla=?', [estado, id_club, id_contempla]);
  if (r.affectedRows == 0) return res.status(404).json({ message: 'Id Equipo no encontrado' });
  res.status(200).json({ message: 'Estado del equipo actualizado' });
}));

//------------ MODIFICAR EQUIPO (RF05.9.2.8.1.3) ------------
router.patch('/update', soloSuClub((req) => req.body && req.body.id_club), h(async (req, res) => {
  const e = req.body || {};
  const nuevoClub = e.id_clubNew || e.id_club;
  if (req.usuario.role === ROLES.DELEGADO && String(nuevoClub) !== String(req.usuario.id_club)) {
    return res.status(403).json({ message: 'Como delegado solo puede gestionar el equipo de su club' });
  }
  const r = await db(
    'UPDATE equipo SET id_club=?, id_serie=?, numero_sorteo=? WHERE id_club=? AND id_contempla=?',
    [nuevoClub, e.id_serie == null || e.id_serie === '' ? 0 : e.id_serie, e.numero_sorteo ?? null, e.id_club, e.id_contempla]
  );
  if (r.affectedRows == 0) return res.status(404).json({ message: 'Id Equipo no encontrado' });
  res.status(200).json({ message: 'Equipo Actualizado con exito' });
}));

//------------ ELIMINAR EQUIPO (RF05.9.2.8.1.4) ------------
router.delete('/delete/:id_club/:id_contempla', soloSuClub((req) => req.params.id_club), h(async (req, res) => {
  const { id_club, id_contempla } = req.params;
  const jugados = await db(
    `SELECT COUNT(*) AS n FROM partido WHERE id_contempla=? AND (id_equipo1=? OR id_equipo2=?)`,
    [id_contempla, id_club, id_club]
  );
  if (jugados[0].n > 0) {
    return res.status(400).json({ message: 'El equipo ya tiene partidos en el fixture. Elimine primero el fixture.' });
  }
  const r = await connection.transaccion(async (tx) => {
    await tx.query('DELETE FROM equipo_jugador WHERE id_club=? AND id_contempla=?', [id_club, id_contempla]);
    return tx.query('DELETE FROM equipo WHERE id_club=? AND id_contempla=?', [id_club, id_contempla]);
  });
  if (r.affectedRows == 0) return res.status(404).json({ message: 'Id Equipo no encontrado' });
  res.status(200).json({ message: 'Equipo eliminado con éxito' });
}));

module.exports = router;
