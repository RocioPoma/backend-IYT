// Equipos inscritos en una categoría de campeonato (RF05.9.2.8.1).
// Flujo del delegado: registra su equipo (borrador) → agrega jugadores → "Solicitar inscripción" →
// el comité técnico aprueba, observa (con comentario) o rechaza. Solo los equipos aprobados entran al fixture.
const express = require('express');
const connection = require('../connection');
const { ROLES, GRUPOS, requireRole } = require('../services/checkRole');
const { soloSuClub, campeonatoDeCategoria, validarGestionDelegado, validarEquipoEditable } = require('../services/club');

const router = express.Router();
const db = connection.consulta;
const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const esDelegado = (req) => req.usuario && req.usuario.role === ROLES.DELEGADO;

const SELECT = `
  SELECT e.*, COALESCE(e.estado,'aprobado') AS estado, b.nombre AS nombre_club, b.comunidad, b.logo,
         DATE_FORMAT(e.fecha_solicitud, '%d-%m-%Y %H:%i') AS fecha_solicitud_f,
         (SELECT COUNT(*) FROM equipo_jugador ej WHERE ej.id_club=e.id_club AND ej.id_contempla=e.id_contempla) AS total_jugadores
  FROM equipo e JOIN club b ON e.id_club = b.id`;

//------------ LISTAR TODOS LOS EQUIPOS ------------
router.get('/get_all', h(async (req, res) => {
  res.status(200).json(await db(`${SELECT} ORDER BY b.nombre`));
}));

//------------ LISTAR EQUIPOS DE UNA CATEGORÍA (RF05.9.2.8.1.1) ------------
// Público: solo aprobados. Delegado: aprobados + el suyo en cualquier estado. Comité/admin: todos.
router.get('/get/:id_contempla', h(async (req, res) => {
  let filtro = '';
  const params = [req.params.id_contempla];
  if (!req.usuario) filtro = " AND COALESCE(e.estado,'aprobado')='aprobado'";
  else if (esDelegado(req)) { filtro = " AND (COALESCE(e.estado,'aprobado')='aprobado' OR e.id_club=?)"; params.push(req.usuario.id_club || 0); }
  res.status(200).json(await db(`${SELECT} WHERE e.id_contempla=?${filtro} ORDER BY e.numero_sorteo, b.nombre`, params));
}));

//------------ SOLICITUDES DE INSCRIPCIÓN PENDIENTES (bandeja del comité) ------------
router.get('/solicitudes', requireRole(GRUPOS.GESTION), h(async (req, res) => {
  const estados = req.query.estado ? String(req.query.estado).split(',') : ['solicitado'];
  res.status(200).json(await db(
    `SELECT e.*, b.nombre AS nombre_club, b.comunidad, d.nombre AS disciplina, cat.nombre AS categoria, con.genero,
            con.num_max_jugadores, camp.nombre_campeonato, camp.gestion, camp.id AS id_campeonato,
            DATE_FORMAT(e.fecha_solicitud, '%d-%m-%Y %H:%i') AS fecha_solicitud_f,
            (SELECT COUNT(*) FROM equipo_jugador ej WHERE ej.id_club=e.id_club AND ej.id_contempla=e.id_contempla) AS total_jugadores
     FROM equipo e
     JOIN club b ON b.id = e.id_club
     JOIN contempla con ON con.id = e.id_contempla
     JOIN disciplina d ON d.id = con.id_disciplina
     JOIN categoria cat ON cat.id = con.id_categoria
     JOIN campeonato camp ON camp.id = con.id_campeonato
     WHERE e.estado IN (?)
     ORDER BY e.fecha_solicitud`,
    [estados]
  ));
}));

//------------ REGISTRAR EQUIPO (RF05.9.2.8.1.2) ------------
router.post('/add', soloSuClub((req) => req.body && req.body.id_club), h(async (req, res) => {
  const e = req.body || {};
  if (!e.id_club || !e.id_contempla) return res.status(400).json({ message: 'Faltan el club o la categoría' });
  const camp = await campeonatoDeCategoria(e.id_contempla);
  if (!camp) return res.status(404).json({ message: 'Categoría no encontrada' });
  if (camp.estado_categoria === 'false') return res.status(400).json({ message: 'La categoría está desactivada' });
  const noPermitido = await validarGestionDelegado(req.usuario, e.id_contempla);
  if (noPermitido) return res.status(403).json({ message: noPermitido });

  const estado = esDelegado(req) ? 'borrador' : 'aprobado';
  await db('INSERT INTO equipo SET ?', [{
    id_club: e.id_club,
    id_contempla: e.id_contempla,
    id_serie: e.id_serie === '' || e.id_serie == null ? 0 : e.id_serie,
    numero_sorteo: e.numero_sorteo === '' ? null : e.numero_sorteo ?? null,
    estado,
  }]);
  res.status(200).json({
    message: estado === 'borrador'
      ? 'Equipo registrado. Agregue a sus jugadores y luego presione "Solicitar inscripción".'
      : 'Equipo agregado con exito',
  });
}));

//------------ SOLICITAR INSCRIPCIÓN (delegado) ------------
router.post('/solicitar', soloSuClub((req) => req.body && req.body.id_club), h(async (req, res) => {
  const { id_club, id_contempla } = req.body || {};
  const f = await db('SELECT estado FROM equipo WHERE id_club=? AND id_contempla=?', [id_club, id_contempla]);
  if (!f.length) return res.status(404).json({ message: 'El equipo no está registrado en esta categoría' });
  if (!['borrador', 'observado'].includes(f[0].estado)) {
    return res.status(400).json({ message: f[0].estado === 'solicitado' ? 'La inscripción ya fue solicitada' : 'La inscripción ya fue resuelta' });
  }
  const noPermitido = await validarGestionDelegado(req.usuario, id_contempla);
  if (noPermitido) return res.status(403).json({ message: noPermitido });

  const camp = await campeonatoDeCategoria(id_contempla);
  const [{ n }] = await db('SELECT COUNT(*) AS n FROM equipo_jugador WHERE id_club=? AND id_contempla=?', [id_club, id_contempla]);
  if (n < 1) return res.status(400).json({ message: 'Agregue al menos un jugador antes de solicitar la inscripción' });
  if (camp.num_max_jugadores && n > camp.num_max_jugadores) {
    return res.status(400).json({ message: `El equipo supera el máximo de ${camp.num_max_jugadores} jugadores` });
  }
  await db("UPDATE equipo SET estado='solicitado', fecha_solicitud=NOW() WHERE id_club=? AND id_contempla=?", [id_club, id_contempla]);
  res.status(200).json({ message: 'Inscripción solicitada. El comité técnico la revisará.' });
}));

//------------ REVISAR INSCRIPCIÓN (comité técnico): aprobado, observado o rechazado ------------
async function revisar(req, res) {
  const { id_club, id_contempla, estado, observacion } = req.body || {};
  if (!['aprobado', 'observado', 'rechazado'].includes(estado)) {
    return res.status(400).json({ message: 'Estado inválido (aprobado, observado o rechazado)' });
  }
  if (estado !== 'aprobado' && (!observacion || String(observacion).trim().length < 3)) {
    return res.status(400).json({ message: 'Escriba el motivo (observación) para el delegado' });
  }
  const r = await db(
    'UPDATE equipo SET estado=?, observacion=?, revisado_por=?, fecha_revision=NOW() WHERE id_club=? AND id_contempla=?',
    [estado, observacion ? String(observacion).trim().slice(0, 500) : null, req.usuario.id, id_club, id_contempla]
  );
  if (r.affectedRows == 0) return res.status(404).json({ message: 'Id Equipo no encontrado' });
  const mensajes = { aprobado: 'Inscripción aprobada', observado: 'Inscripción observada; el delegado verá el comentario', rechazado: 'Inscripción rechazada' };
  res.status(200).json({ message: mensajes[estado] });
}
router.patch('/revisar', requireRole(GRUPOS.GESTION), h(revisar));
router.patch('/updateStatus', requireRole(GRUPOS.GESTION), h(revisar)); // compatibilidad

//------------ MODIFICAR EQUIPO (RF05.9.2.8.1.3) ------------
router.patch('/update', soloSuClub((req) => req.body && req.body.id_club), h(async (req, res) => {
  const e = req.body || {};
  const nuevoClub = e.id_clubNew || e.id_club;
  if (esDelegado(req) && String(nuevoClub) !== String(req.usuario.id_club)) {
    return res.status(403).json({ message: 'Como delegado solo puede gestionar el equipo de su club' });
  }
  const bloqueo = await validarEquipoEditable(req.usuario, e.id_club, e.id_contempla);
  if (bloqueo) return res.status(400).json({ message: bloqueo });
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
  const bloqueo = await validarEquipoEditable(req.usuario, id_club, id_contempla);
  if (bloqueo) return res.status(400).json({ message: bloqueo });
  const [{ n }] = await db(
    'SELECT COUNT(*) AS n FROM partido WHERE id_contempla=? AND (id_equipo1=? OR id_equipo2=?)',
    [id_contempla, id_club, id_club]
  );
  if (n > 0) return res.status(400).json({ message: 'El equipo ya tiene partidos en el fixture. Elimine primero el fixture.' });
  const r = await connection.transaccion(async (tx) => {
    await tx.query('DELETE FROM equipo_jugador WHERE id_club=? AND id_contempla=?', [id_club, id_contempla]);
    return tx.query('DELETE FROM equipo WHERE id_club=? AND id_contempla=?', [id_club, id_contempla]);
  });
  if (r.affectedRows == 0) return res.status(404).json({ message: 'Id Equipo no encontrado' });
  res.status(200).json({ message: 'Equipo eliminado con éxito' });
}));

module.exports = router;
