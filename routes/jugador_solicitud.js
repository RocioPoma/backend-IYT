// Solicitudes de alta y de actualización de jugadores.
// - El delegado registra un jugador nuevo o edita uno de su club (todo menos CI y club).
// - Guarda como borrador y luego presiona "Solicitar"; el comité técnico acepta u observa (con comentario).
// - Solo al aceptar se modifica la lista oficial (tabla jugador).
const express = require('express');
const connection = require('../connection');
const multer = require('../libs/multer');
const storage = require('../services/storage');
const { ROLES, GRUPOS, requireRole } = require('../services/checkRole');

const router = express.Router();
const db = connection.consulta;
const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const ABIERTAS = ['borrador', 'pendiente', 'observado'];
const EDITABLES = ['borrador', 'observado'];
const CAMPOS = ['nombre', 'ap_paterno', 'ap_materno', 'fecha_nacimiento', 'sexo', 'decendencia'];

const esDelegado = (req) => req.usuario.role === ROLES.DELEGADO;
const archivo = (req, campo) => (req.files && req.files[campo] && req.files[campo][0] ? req.files[campo][0].filename : null);

function error(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

async function limpiarSubidos(req) {
  for (const c of ['foto', 'documento']) await storage.eliminarSeguro(archivo(req, c));
}

function validarDatos(d, { alta }) {
  if (alta && (!d.ci || !/^[0-9A-Za-z-]{4,15}$/.test(String(d.ci).trim()))) return 'El CI es obligatorio (4 a 15 caracteres)';
  if (!d.nombre || String(d.nombre).trim().length < 2) return 'El nombre es obligatorio';
  if (!d.ap_paterno && !d.ap_materno) return 'Debe registrar al menos un apellido';
  if (!d.fecha_nacimiento || isNaN(new Date(d.fecha_nacimiento))) return 'La fecha de nacimiento es obligatoria';
  if (new Date(d.fecha_nacimiento) > new Date()) return 'La fecha de nacimiento no puede ser futura';
  if (!d.sexo) return 'El sexo es obligatorio';
  return null;
}

function fecha(v) {
  if (!v) return null;
  const s = String(v);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : new Date(v).toISOString().slice(0, 10);
}

async function obtener(id) {
  const f = await db('SELECT * FROM jugador_solicitud WHERE id=?', [id]);
  if (!f.length) throw error(404, 'Solicitud no encontrada');
  return f[0];
}

function verificarPropietario(req, sol) {
  if (esDelegado(req) && String(sol.id_club) !== String(req.usuario.id_club)) {
    throw error(403, 'Solo puede gestionar las solicitudes de su club');
  }
}

async function haySolicitudAbierta(ci, excluirId = 0) {
  const f = await db(`SELECT id FROM jugador_solicitud WHERE ci=? AND estado IN (?) AND id<>?`, [ci, ABIERTAS, excluirId]);
  return f.length > 0;
}

const SELECT = `
  SELECT s.*, DATE_FORMAT(s.fecha_nacimiento, '%Y-%m-%d') AS fecha_nacimiento,
         DATE_FORMAT(s.fecha_solicitud, '%d-%m-%Y %H:%i') AS fecha_solicitud_f,
         DATE_FORMAT(s.fecha_revision, '%d-%m-%Y %H:%i') AS fecha_revision_f,
         c.nombre AS club, c.comunidad AS comunidad_club, us.name AS solicitado_por_nombre, ur.name AS revisado_por_nombre,
         j.nombre AS actual_nombre, j.ap_paterno AS actual_ap_paterno, j.ap_materno AS actual_ap_materno,
         DATE_FORMAT(j.fecha_nacimiento, '%Y-%m-%d') AS actual_fecha_nacimiento, j.sexo AS actual_sexo,
         j.decendencia AS actual_decendencia, j.foto AS actual_foto, j.documento AS actual_documento
  FROM jugador_solicitud s
  JOIN club c ON c.id = s.id_club
  LEFT JOIN user us ON us.id = s.solicitado_por
  LEFT JOIN user ur ON ur.id = s.revisado_por
  LEFT JOIN jugador j ON j.ci = s.ci`;

//------------ LISTAR SOLICITUDES ------------
// Delegado: las de su club. Comité/administrador: todas (filtro ?estado=pendiente, ?tipo=alta).
router.get('/get', h(async (req, res) => {
  const cond = [];
  const params = [];
  if (esDelegado(req)) { cond.push('s.id_club=?'); params.push(req.usuario.id_club || 0); }
  if (req.query.estado) { cond.push('s.estado IN (?)'); params.push(String(req.query.estado).split(',')); }
  else if (!esDelegado(req)) { cond.push("s.estado <> 'borrador'"); }
  if (req.query.tipo) { cond.push('s.tipo=?'); params.push(req.query.tipo); }
  const filas = await db(
    `${SELECT} ${cond.length ? 'WHERE ' + cond.join(' AND ') : ''}
     ORDER BY FIELD(s.estado,'pendiente','observado','borrador','aprobado','anulado'), s.fecha_solicitud DESC, s.id DESC`,
    params
  );
  res.status(200).json(filas);
}));

router.get('/getById/:id', h(async (req, res) => {
  const f = await db(`${SELECT} WHERE s.id=?`, [req.params.id]);
  if (!f.length) return res.status(404).json({ message: 'Solicitud no encontrada' });
  verificarPropietario(req, f[0]);
  res.status(200).json(f[0]);
}));

//------------ NUEVO JUGADOR (alta) ------------
router.post('/alta', multer.campos(['foto', 'documento']), h(async (req, res) => {
  const d = req.body || {};
  try {
    const idClub = esDelegado(req) ? req.usuario.id_club : d.id_club;
    if (!idClub) throw error(400, esDelegado(req) ? 'Su usuario no tiene un club asignado' : 'Seleccione el club');
    const msg = validarDatos(d, { alta: true });
    if (msg) throw error(400, msg);
    const ci = String(d.ci).trim();
    if ((await db('SELECT ci FROM jugador WHERE ci=?', [ci])).length) throw error(400, 'Ya existe un jugador registrado con ese CI');
    if (await haySolicitudAbierta(ci)) throw error(400, 'Ya hay una solicitud en curso para ese CI');

    const enviar = String(d.enviar) === 'true';
    const r = await db('INSERT INTO jugador_solicitud SET ?', [{
      tipo: 'alta', ci, id_club: idClub,
      ...Object.fromEntries(CAMPOS.map((c) => [c, c === 'fecha_nacimiento' ? fecha(d[c]) : (d[c] || null)])),
      foto: archivo(req, 'foto'), documento: archivo(req, 'documento'),
      estado: enviar ? 'pendiente' : 'borrador',
      fecha_solicitud: enviar ? new Date() : null,
      solicitado_por: req.usuario.id,
    }]);
    res.status(200).json({
      id: r.insertId,
      message: enviar ? 'Solicitud enviada. El comité técnico la revisará.' : 'Jugador guardado como borrador. Presione "Solicitar" cuando esté completo.',
    });
  } catch (e) {
    await limpiarSubidos(req);
    throw e;
  }
}));

//------------ EDITAR JUGADOR OFICIAL (actualización) ------------
// Se puede cambiar todo menos el CI y el club. Los campos vacíos conservan el valor actual.
router.post('/actualizacion', multer.campos(['foto', 'documento']), h(async (req, res) => {
  const d = req.body || {};
  try {
    const actual = (await db('SELECT * FROM jugador WHERE ci=?', [d.ci]))[0];
    if (!actual) throw error(404, 'Jugador no encontrado');
    if (esDelegado(req) && String(actual.clubId) !== String(req.usuario.id_club)) {
      throw error(403, 'Solo puede editar jugadores de su club');
    }
    if (await haySolicitudAbierta(actual.ci)) {
      throw error(400, 'Este jugador ya tiene una solicitud en curso. Edite esa solicitud en "Mis solicitudes".');
    }
    const propuesto = Object.fromEntries(CAMPOS.map((c) => [c, d[c] !== undefined && d[c] !== '' ? d[c] : actual[c]]));
    propuesto.fecha_nacimiento = fecha(propuesto.fecha_nacimiento);
    const msg = validarDatos(propuesto, { alta: false });
    if (msg) throw error(400, msg);

    const enviar = String(d.enviar) === 'true';
    const r = await db('INSERT INTO jugador_solicitud SET ?', [{
      tipo: 'actualizacion', ci: actual.ci, id_club: actual.clubId, ...propuesto,
      foto: archivo(req, 'foto'), documento: archivo(req, 'documento'),
      estado: enviar ? 'pendiente' : 'borrador',
      fecha_solicitud: enviar ? new Date() : null,
      solicitado_por: req.usuario.id,
    }]);
    res.status(200).json({
      id: r.insertId,
      message: enviar ? 'Solicitud de actualización enviada al comité técnico.' : 'Cambios guardados. Presione "Solicitar actualización" para enviarlos.',
    });
  } catch (e) {
    await limpiarSubidos(req);
    throw e;
  }
}));

//------------ MODIFICAR UNA SOLICITUD (borrador u observada) ------------
router.patch('/update/:id', multer.campos(['foto', 'documento']), h(async (req, res) => {
  const d = req.body || {};
  try {
    const sol = await obtener(req.params.id);
    verificarPropietario(req, sol);
    // El delegado corrige borradores u observadas; el comité técnico también puede corregir
    // una solicitud pendiente mientras la revisa (antes de aceptarla)
    const puedeComite = GRUPOS.GESTION.includes(req.usuario.role) && sol.estado === 'pendiente';
    if (!EDITABLES.includes(sol.estado) && !puedeComite) throw error(400, 'Solo se pueden modificar solicitudes en borrador u observadas');

    const nuevo = Object.fromEntries(CAMPOS.map((c) => [c, d[c] !== undefined && d[c] !== '' ? d[c] : sol[c]]));
    nuevo.fecha_nacimiento = fecha(nuevo.fecha_nacimiento);
    let ci = sol.ci;
    if (sol.tipo === 'alta' && d.ci && String(d.ci).trim() !== sol.ci) {
      ci = String(d.ci).trim();
      if ((await db('SELECT ci FROM jugador WHERE ci=?', [ci])).length) throw error(400, 'Ya existe un jugador registrado con ese CI');
      if (await haySolicitudAbierta(ci, sol.id)) throw error(400, 'Ya hay una solicitud en curso para ese CI');
    }
    const msg = validarDatos({ ...nuevo, ci }, { alta: sol.tipo === 'alta' });
    if (msg) throw error(400, msg);

    const foto = archivo(req, 'foto') || sol.foto;
    const documento = archivo(req, 'documento') || sol.documento;
    await db('UPDATE jugador_solicitud SET ? WHERE id=?', [{ ...nuevo, ci, foto, documento }, sol.id]);
    if (archivo(req, 'foto') && sol.foto) await storage.eliminarSeguro(sol.foto);
    if (archivo(req, 'documento') && sol.documento) await storage.eliminarSeguro(sol.documento);
    res.status(200).json({ message: 'Solicitud actualizada' });
  } catch (e) {
    await limpiarSubidos(req);
    throw e;
  }
}));

//------------ ENVIAR AL COMITÉ ("Solicitar" / "Solicitar actualización") ------------
router.patch('/solicitar/:id', h(async (req, res) => {
  const sol = await obtener(req.params.id);
  verificarPropietario(req, sol);
  if (!EDITABLES.includes(sol.estado)) throw error(400, 'La solicitud ya fue enviada');
  if (sol.tipo === 'alta' && (await db('SELECT ci FROM jugador WHERE ci=?', [sol.ci])).length) {
    throw error(400, 'Ya existe un jugador registrado con ese CI');
  }
  await db("UPDATE jugador_solicitud SET estado='pendiente', fecha_solicitud=NOW() WHERE id=?", [sol.id]);
  res.status(200).json({ message: 'Solicitud enviada al comité técnico' });
}));

//------------ ANULAR (el delegado retira su solicitud) ------------
router.patch('/anular/:id', h(async (req, res) => {
  const sol = await obtener(req.params.id);
  verificarPropietario(req, sol);
  if (!ABIERTAS.includes(sol.estado)) throw error(400, 'La solicitud ya fue resuelta');
  await db("UPDATE jugador_solicitud SET estado='anulado' WHERE id=?", [sol.id]);
  await storage.eliminarSeguro(sol.foto);
  await storage.eliminarSeguro(sol.documento);
  res.status(200).json({ message: 'Solicitud anulada' });
}));

//------------ REVISIÓN DEL COMITÉ TÉCNICO: aceptar u observar ------------
router.patch('/revisar/:id', requireRole(GRUPOS.GESTION), h(async (req, res) => {
  const { decision, observacion } = req.body || {};
  const sol = await obtener(req.params.id);
  if (sol.estado !== 'pendiente') throw error(400, 'Solo se pueden revisar solicitudes pendientes');

  if (decision === 'observar') {
    if (!observacion || String(observacion).trim().length < 3) throw error(400, 'Escriba el comentario de la observación');
    await db(
      "UPDATE jugador_solicitud SET estado='observado', observacion=?, revisado_por=?, fecha_revision=NOW() WHERE id=?",
      [String(observacion).trim().slice(0, 500), req.usuario.id, sol.id]
    );
    return res.status(200).json({ message: 'Solicitud observada. El delegado verá su comentario.' });
  }
  if (decision !== 'aceptar') throw error(400, 'Decisión inválida (aceptar u observar)');

  const reemplazados = [];
  await connection.transaccion(async (tx) => {
    const datos = Object.fromEntries(CAMPOS.map((c) => [c, sol[c]]));
    if (sol.tipo === 'alta') {
      if ((await tx.query('SELECT ci FROM jugador WHERE ci=? FOR UPDATE', [sol.ci])).length) {
        throw error(400, 'Ya existe un jugador registrado con ese CI');
      }
      await tx.query('INSERT INTO jugador SET ?', [{
        ci: sol.ci, ...datos, clubId: sol.id_club, fecha_habilitacion: new Date(),
        foto: sol.foto || '', documento: sol.documento || null, status: 'true',
      }]);
    } else {
      const actual = (await tx.query('SELECT foto, documento FROM jugador WHERE ci=? FOR UPDATE', [sol.ci]))[0];
      if (!actual) throw error(404, 'El jugador ya no existe');
      const cambios = { ...datos };
      if (sol.foto) { cambios.foto = sol.foto; if (actual.foto && actual.foto !== sol.foto) reemplazados.push(actual.foto); }
      if (sol.documento) { cambios.documento = sol.documento; if (actual.documento && actual.documento !== sol.documento) reemplazados.push(actual.documento); }
      // El CI y el club nunca cambian por esta vía
      await tx.query('UPDATE jugador SET ? WHERE ci=?', [cambios, sol.ci]);
    }
    await tx.query(
      "UPDATE jugador_solicitud SET estado='aprobado', observacion=?, revisado_por=?, fecha_revision=NOW() WHERE id=?",
      [observacion ? String(observacion).trim().slice(0, 500) : null, req.usuario.id, sol.id]
    );
  });
  for (const f of reemplazados) await storage.eliminarSeguro(f);
  res.status(200).json({
    message: sol.tipo === 'alta' ? 'Jugador aceptado y agregado a la lista oficial' : 'Actualización aceptada y aplicada a la lista oficial',
  });
}));

module.exports = router;
