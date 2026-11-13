// El delegado solo puede inscribir/modificar equipos y jugadores de su propio club.
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

module.exports = { soloSuClub };
