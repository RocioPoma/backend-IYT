const jwt = require('jsonwebtoken');
const config = require('../config');

function extraerToken(req) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) return authHeader.slice(7);
  return null;
}

function verificar(token) {
  return jwt.verify(token, config.jwt.secreto);
}

/** Exige un token válido. Deja los datos del usuario en res.locals (como antes) y en req.usuario. */
function authenticateToken(req, res, next) {
  const token = extraerToken(req);
  if (!token) return res.status(401).json({ message: 'Debe iniciar sesión' });
  try {
    const datos = verificar(token);
    res.locals = { ...res.locals, ...datos };
    req.usuario = datos;
    return next();
  } catch (e) {
    const expirado = e.name === 'TokenExpiredError';
    return res.status(401).json({ message: expirado ? 'La sesión expiró, vuelva a iniciar sesión' : 'Token inválido' });
  }
}

/** Si hay token válido lo usa; si no, continúa como visitante (para la vista pública). */
function optionalAuth(req, res, next) {
  const token = extraerToken(req);
  if (token) {
    try {
      const datos = verificar(token);
      res.locals = { ...res.locals, ...datos };
      req.usuario = datos;
    } catch (_) {
      /* visitante */
    }
  }
  next();
}

function firmar(payload) {
  return jwt.sign(payload, config.jwt.secreto, { expiresIn: config.jwt.duracion });
}

module.exports = { authenticateToken, optionalAuth, firmar, verificar };
