// Roles del sistema según el documento de requerimientos (RF02 y casos de uso).
const ROLES = {
  ADMIN: 'admin',
  PRESIDENTE: 'presidente',
  COMITE: 'comite_tecnico',
  RESPONSABLE: 'responsable_categoria',
  DELEGADO: 'delegado',
};

const TODOS = Object.values(ROLES);

// Grupos de permisos tomados de los "Actores" de cada caso de uso
const GRUPOS = {
  ADMIN: [ROLES.ADMIN],
  // Clubs, jugadores, campeonatos, categorías, disciplinas, árbitros, campos de juego, series, pases
  GESTION: [ROLES.ADMIN, ROLES.COMITE],
  // Fixture, partidos, hechos del partido, medallero
  PARTIDOS: [ROLES.ADMIN, ROLES.COMITE, ROLES.RESPONSABLE],
  // Inscripción de equipos y jugadores al equipo
  EQUIPOS: [ROLES.ADMIN, ROLES.COMITE, ROLES.DELEGADO],
  // Noticias (RF05.9.3: administrador o presidente; caso de uso: comité técnico)
  NOTICIAS: [ROLES.ADMIN, ROLES.COMITE, ROLES.PRESIDENTE],
  // Auspiciadores (RF05.9.4: presidente del comité organizador)
  AUSPICIO: [ROLES.ADMIN, ROLES.COMITE, ROLES.PRESIDENTE],
  // Normas / reglamento (RF12: presidente)
  NORMAS: [ROLES.ADMIN, ROLES.PRESIDENTE],
  TODOS,
};

function rolValido(rol) {
  return TODOS.includes(rol);
}

/** Middleware: exige que el usuario autenticado tenga uno de los roles indicados. */
function requireRole(...roles) {
  const permitidos = roles.flat();
  return (req, res, next) => {
    const rol = (req.usuario && req.usuario.role) || res.locals.role;
    if (!rol) return res.status(401).json({ message: 'Debe iniciar sesión' });
    if (!permitidos.includes(rol)) {
      return res.status(403).json({ message: 'No tiene permisos para realizar esta acción' });
    }
    next();
  };
}

/** Compatibilidad con el código anterior: cualquier rol excepto delegado. */
const checkRole = requireRole(ROLES.ADMIN, ROLES.PRESIDENTE, ROLES.COMITE, ROLES.RESPONSABLE);

module.exports = { ROLES, GRUPOS, requireRole, rolValido, checkRole };
