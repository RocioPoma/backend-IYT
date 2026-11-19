// Pase de jugador (RF08) en tres pasos:
//   1. El delegado del club de DESTINO solicita el pase de un jugador de otro club   → solicitado
//   2. El delegado del club de ORIGEN acepta (o rechaza) que el jugador se vaya       → aceptado_origen
//   3. El comité técnico aprueba (o rechaza). Recién entonces el jugador cambia de club → aprobado
// El comité técnico / administrador también puede registrar un pase directo (queda aprobado).
const express = require('express');
const connection = require('../connection');
const multer = require('../libs/multer');
const { eliminarConArchivos, reemplazarArchivo } = require('../libs/archivos');
const storage = require('../services/storage');
const { ROLES, GRUPOS, requireRole } = require('../services/checkRole');

const router = express.Router();
const db = connection.consulta;
const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const esDelegado = (req) => req.usuario && req.usuario.role === ROLES.DELEGADO;
const ABIERTOS = ['solicitado', 'aceptado_origen'];

function error(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

const SELECT = `
  SELECT pj.*, c1.nombre AS club_solicitante, c2.nombre AS club_solicitado,
         j.nombre, j.ap_paterno, j.ap_materno, j.foto,
         DATE_FORMAT(pj.fecha, '%d-%m-%Y') AS fecha2,
         DATE_FORMAT(pj.fecha_respuesta, '%d-%m-%Y %H:%i') AS fecha_respuesta_f,
         DATE_FORMAT(pj.fecha_revision, '%d-%m-%Y %H:%i') AS fecha_revision_f,
         us.name AS solicitado_por_nombre, ur.name AS respondido_por_nombre, uv.name AS revisado_por_nombre
  FROM pase_jugador pj
  JOIN club c1 ON pj.id_club_solicitante = c1.id
  JOIN club c2 ON pj.id_club_solicitado = c2.id
  JOIN jugador j ON pj.ci = j.ci
  LEFT JOIN user us ON us.id = pj.solicitado_por
  LEFT JOIN user ur ON ur.id = pj.respondido_por
  LEFT JOIN user uv ON uv.id = pj.revisado_por`;

async function obtener(id) {
  const f = await db('SELECT * FROM pase_jugador WHERE id_pase=?', [id]);
  if (!f.length) throw error(404, 'Id Pase no encontrado');
  return f[0];
}

//------------ LISTAR PASES (RF08.5) ------------
// Delegado: los pases donde participa su club. Comité/administrador: todos.
router.get('/get', h(async (req, res) => {
  const params = [];
  let filtro = '';
  if (esDelegado(req)) {
    filtro = 'WHERE (pj.id_club_solicitante=? OR pj.id_club_solicitado=?)';
    params.push(req.usuario.id_club || 0, req.usuario.id_club || 0);
  }
  if (req.query.estado) {
    filtro += `${filtro ? ' AND' : 'WHERE'} pj.estado IN (?)`;
    params.push(String(req.query.estado).split(','));
  }
  res.status(200).json(await db(
    `${SELECT} ${filtro}
     ORDER BY FIELD(pj.estado,'aceptado_origen','solicitado','aprobado','rechazado','anulado'), pj.fecha DESC, pj.id_pase DESC`,
    params
  ));
}));

//------------ BUSCAR JUGADOR POR CI (para solicitar un pase) ------------
// Devuelve solo los datos necesarios para identificarlo (no fecha de nacimiento ni documentos).
router.get('/buscarJugador/:ci', h(async (req, res) => {
  const f = await db(
    `SELECT j.ci, j.nombre, j.ap_paterno, j.ap_materno, j.foto, j.clubId, c.nombre AS club
     FROM jugador j JOIN club c ON c.id = j.clubId WHERE j.ci = ?`,
    [String(req.params.ci).trim()]
  );
  if (!f.length) return res.status(404).json({ message: 'No existe un jugador con ese CI' });
  res.status(200).json(f[0]);
}));

//------------ 1. SOLICITAR PASE (delegado del club de destino) ------------
router.post('/solicitar', multer.single('documento'), h(async (req, res) => {
  const p = req.body || {};
  try {
    const destino = esDelegado(req) ? req.usuario.id_club : p.id_club_solicitante;
    if (!destino) throw error(400, esDelegado(req) ? 'Su usuario no tiene un club asignado' : 'Seleccione el club de destino');
    const jug = (await db('SELECT ci, clubId FROM jugador WHERE ci=?', [String(p.ci || '').trim()]))[0];
    if (!jug) throw error(404, 'No existe un jugador con ese CI');
    if (String(jug.clubId) === String(destino)) throw error(400, 'El jugador ya pertenece a su club');
    const abiertos = await db('SELECT id_pase FROM pase_jugador WHERE ci=? AND estado IN (?)', [jug.ci, ABIERTOS]);
    if (abiertos.length) throw error(400, 'Este jugador ya tiene un pase en trámite');

    await db('INSERT INTO pase_jugador SET ?', [{
      id_club_solicitante: destino,
      id_club_solicitado: jug.clubId,
      ci: jug.ci,
      fecha: p.fecha ? new Date(p.fecha) : new Date(),
      documento: req.file ? req.file.filename : null,
      observacion: p.observacion ? String(p.observacion).slice(0, 500) : null,
      estado: 'solicitado',
      solicitado_por: req.usuario.id,
    }]);
    res.status(200).json({ message: 'Pase solicitado. Ahora debe aceptarlo el club de origen.' });
  } catch (e) {
    if (req.file) await storage.eliminarSeguro(req.file.filename);
    throw e;
  }
}));

//------------ 2. RESPUESTA DEL CLUB DE ORIGEN: aceptar o rechazar ------------
// Puede adjuntar (o reemplazar) la hoja de pase firmada.
router.patch('/responder/:id', multer.single('documento'), h(async (req, res) => {
  const { decision, observacion } = req.body || {};
  try {
    const pase = await obtener(req.params.id);
    if (esDelegado(req) && String(pase.id_club_solicitado) !== String(req.usuario.id_club)) {
      throw error(403, 'Solo el delegado del club de origen puede responder este pase');
    }
    if (pase.estado !== 'solicitado') throw error(400, 'Este pase ya fue respondido');
    if (!['aceptar', 'rechazar'].includes(decision)) throw error(400, 'Decisión inválida (aceptar o rechazar)');
    if (decision === 'rechazar' && (!observacion || String(observacion).trim().length < 3)) {
      throw error(400, 'Escriba el motivo del rechazo');
    }
    const documento = req.file ? req.file.filename : pase.documento;
    await db(
      'UPDATE pase_jugador SET estado=?, observacion=?, documento=?, respondido_por=?, fecha_respuesta=NOW() WHERE id_pase=?',
      [decision === 'aceptar' ? 'aceptado_origen' : 'rechazado',
        observacion ? String(observacion).trim().slice(0, 500) : pase.observacion, documento, req.usuario.id, pase.id_pase]
    );
    if (req.file) await reemplazarArchivo(pase.documento, documento);
    res.status(200).json({
      message: decision === 'aceptar' ? 'Pase aceptado. Falta la aprobación del comité técnico.' : 'Pase rechazado',
    });
  } catch (e) {
    if (req.file) await storage.eliminarSeguro(req.file.filename);
    throw e;
  }
}));

//------------ 3. REVISIÓN DEL COMITÉ TÉCNICO: aprobar o rechazar ------------
router.patch('/revisar/:id', requireRole(GRUPOS.GESTION), h(async (req, res) => {
  const { decision, observacion } = req.body || {};
  const pase = await obtener(req.params.id);
  if (pase.estado !== 'aceptado_origen') {
    throw error(400, pase.estado === 'solicitado' ? 'Primero debe aceptarlo el club de origen' : 'Este pase ya fue resuelto');
  }
  if (decision === 'rechazar') {
    if (!observacion || String(observacion).trim().length < 3) throw error(400, 'Escriba el motivo del rechazo');
    await db("UPDATE pase_jugador SET estado='rechazado', observacion=?, revisado_por=?, fecha_revision=NOW() WHERE id_pase=?",
      [String(observacion).trim().slice(0, 500), req.usuario.id, pase.id_pase]);
    return res.status(200).json({ message: 'Pase rechazado' });
  }
  if (decision !== 'aprobar') throw error(400, 'Decisión inválida (aprobar o rechazar)');

  await connection.transaccion(async (tx) => {
    const jug = (await tx.query('SELECT clubId FROM jugador WHERE ci=? FOR UPDATE', [pase.ci]))[0];
    if (!jug) throw error(404, 'El jugador ya no existe');
    if (String(jug.clubId) !== String(pase.id_club_solicitado)) throw error(400, 'El jugador ya no pertenece al club de origen');
    await tx.query('UPDATE jugador SET clubId=? WHERE ci=?', [pase.id_club_solicitante, pase.ci]);
    await tx.query(
      "UPDATE pase_jugador SET estado='aprobado', observacion=COALESCE(?, observacion), revisado_por=?, fecha_revision=NOW() WHERE id_pase=?",
      [observacion ? String(observacion).trim().slice(0, 500) : null, req.usuario.id, pase.id_pase]
    );
  });
  res.status(200).json({ message: 'Pase aprobado. El jugador ahora pertenece al nuevo club.' });
}));

//------------ ANULAR (el club de destino retira su solicitud) ------------
router.patch('/anular/:id', h(async (req, res) => {
  const pase = await obtener(req.params.id);
  if (esDelegado(req) && String(pase.id_club_solicitante) !== String(req.usuario.id_club)) {
    throw error(403, 'Solo el club que solicitó el pase puede anularlo');
  }
  if (!ABIERTOS.includes(pase.estado)) throw error(400, 'Este pase ya fue resuelto');
  await db("UPDATE pase_jugador SET estado='anulado' WHERE id_pase=?", [pase.id_pase]);
  res.status(200).json({ message: 'Solicitud de pase anulada' });
}));

//------------ REGISTRO DIRECTO POR EL COMITÉ (RF08.1): queda aprobado ------------
router.post('/add', requireRole(GRUPOS.GESTION), multer.single('documento'), h(async (req, res) => {
  const p = req.body || {};
  try {
    if (!p.ci || !p.id_club_solicitante || !p.id_club_solicitado) throw error(400, 'Faltan datos del pase (jugador y clubs)');
    if (String(p.id_club_solicitante) === String(p.id_club_solicitado)) {
      throw error(400, 'El club solicitante y el club de origen no pueden ser el mismo');
    }
    if (!req.file) throw error(400, 'Debe adjuntar la hoja de pase firmada (RF08)');
    await connection.transaccion(async (tx) => {
      const jug = await tx.query('SELECT clubId FROM jugador WHERE ci=? FOR UPDATE', [p.ci]);
      if (!jug.length) throw error(404, 'Jugador CI no encontrado');
      await tx.query('INSERT INTO pase_jugador SET ?', [{
        id_club_solicitante: p.id_club_solicitante,
        id_club_solicitado: p.id_club_solicitado,
        ci: p.ci,
        fecha: p.fecha ? new Date(p.fecha) : new Date(),
        documento: req.file.filename,
        estado: 'aprobado',
        solicitado_por: req.usuario.id,
        revisado_por: req.usuario.id,
        fecha_revision: new Date(),
      }]);
      await tx.query('UPDATE jugador SET clubId=? WHERE ci=?', [p.id_club_solicitante, p.ci]);
    });
  } catch (e) {
    if (req.file) await storage.eliminarSeguro(req.file.filename);
    throw e;
  }
  res.status(200).json({ message: 'Pase Jugador agregado y Club ID actualizado con éxito' });
}));

//------------ MODIFICAR PASE (RF08.2) — comité técnico ------------
router.patch('/update', requireRole(GRUPOS.GESTION), multer.single('documento'), h(async (req, res) => {
  const p = req.body || {};
  const actual = await db('SELECT documento FROM pase_jugador WHERE id_pase=?', [p.id_pase]);
  if (!actual.length) {
    if (req.file) await storage.eliminarSeguro(req.file.filename);
    return res.status(404).json({ message: 'Id Pase no encontrado' });
  }
  const documento = req.file ? req.file.filename : actual[0].documento;
  await db(
    'UPDATE pase_jugador SET id_club_solicitante=?, id_club_solicitado=?, ci=?, fecha=?, documento=? WHERE id_pase=?',
    [p.id_club_solicitante, p.id_club_solicitado, p.ci, p.fecha ? new Date(p.fecha) : new Date(), documento, p.id_pase]
  );
  if (req.file) await reemplazarArchivo(actual[0].documento, documento);
  res.status(200).json({ message: 'Pase jugador Actualizado con exito' });
}));

//------------ ELIMINAR PASE (RF08.3) — comité técnico ------------
router.delete('/delete/:id_pase', requireRole(GRUPOS.GESTION), h(async (req, res) => {
  const r = await eliminarConArchivos('pase_jugador', 'id_pase', req.params.id_pase, ['documento']);
  if (r.affectedRows == 0) return res.status(404).json({ message: 'Id Pase no encontrado' });
  res.status(200).json({ message: 'Pase jugador eliminado con éxito' });
}));

module.exports = router;
