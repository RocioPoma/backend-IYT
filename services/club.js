// Reglas del delegado: solo su club y solo la gestión que tiene asignada.
const connection = require('../connection');
const { ROLES } = require('./checkRole');

function soloSuClub(obtenerClub) {
  return (req, res, next) => {
    const u = req.usuario;
    if (!u || u.role !== ROLES.DELEGADO) return next();
    const club = obtenerClub(req);
    if (!u.id_club || String(club) !== String(u.id_club)) {
      return res.status(403).json({ message: 'Como delegado solo puede gestionar el equipo de su club' });
    }
    next();
  };
}

/** Datos del campeonato de una categoría (contempla). */
async function campeonatoDeCategoria(idContempla) {
  const f = await connection.consulta(
    `SELECT c.id, c.gestion, c.status, con.estado AS estado_categoria, con.num_max_jugadores
     FROM contempla con JOIN campeonato c ON c.id = con.id_campeonato WHERE con.id = ?`,
    [idContempla]
  );
  return f[0] || null;
}

/** Devuelve un mensaje de error si el delegado no puede inscribir en esa categoría; null si puede. */
async function validarGestionDelegado(usuario, idContempla) {
  if (!usuario || usuario.role !== ROLES.DELEGADO) return null;
  // La gestión asignada se lee de la BD (puede haber cambiado después de iniciar sesión)
  const u = (await connection.consulta('SELECT gestion FROM user WHERE id=?', [usuario.id]))[0];
  const camp = await campeonatoDeCategoria(idContempla);
  if (!camp) return 'Categoría no encontrada';
  if (!u || !u.gestion) return 'Su usuario no tiene una gestión asignada. Pida al administrador que se la asigne.';
  if (Number(camp.gestion) !== Number(u.gestion)) {
    return `Solo puede inscribir equipos en campeonatos de la gestión ${u.gestion}`;
  }
  return null;
}

/** Estado de la inscripción del equipo, o null si no existe. */
async function estadoEquipo(idClub, idContempla) {
  const f = await connection.consulta('SELECT estado FROM equipo WHERE id_club=? AND id_contempla=?', [idClub, idContempla]);
  return f[0] ? f[0].estado || 'aprobado' : null;
}

/** El delegado solo modifica su equipo mientras está en borrador u observado. */
async function validarEquipoEditable(usuario, idClub, idContempla) {
  if (!usuario || usuario.role !== ROLES.DELEGADO) return null;
  const estado = await estadoEquipo(idClub, idContempla);
  if (!estado) return 'El equipo no está inscrito en esta categoría';
  if (!['borrador', 'observado'].includes(estado)) {
    return estado === 'solicitado'
      ? 'La inscripción ya fue enviada al comité técnico; no se puede modificar mientras se revisa'
      : 'La inscripción ya fue aprobada; para cambios comuníquese con el comité técnico';
  }
  return null;
}

module.exports = { soloSuClub, campeonatoDeCategoria, validarGestionDelegado, estadoEquipo, validarEquipoEditable };
