// Política de acceso por módulo. Se monta ANTES de cada router en index.js, así la autenticación
// ocurre antes de procesar archivos subidos, y las rutas de consulta pueden ser públicas (RF01).
const { authenticateToken, optionalAuth } = require('./authentication');
const { requireRole } = require('./checkRole');

/**
 * @param {object} opciones
 * @param {'public'|'auth'|string[]} opciones.lectura   acceso para GET
 * @param {'public'|'auth'|string[]} opciones.escritura acceso para POST/PATCH/PUT/DELETE
 * @param {object} opciones.reglas  excepciones: { 'GET /getJugadorEnBanca': 'auth', 'POST /add': [roles] }
 */
function politica({ lectura = 'auth', escritura, reglas = {} }) {
  const lista = Object.entries(reglas).map(([clave, acceso]) => {
    const [metodo, ruta] = clave.split(' ');
    return { metodo: metodo.toUpperCase(), ruta: ruta.toLowerCase(), acceso };
  });

  return (req, res, next) => {
    const metodo = req.method === 'HEAD' ? 'GET' : req.method;
    if (metodo === 'OPTIONS') return next();
    const ruta = req.path.toLowerCase();
    const regla = lista.find(
      (r) => r.metodo === metodo && (ruta === r.ruta || ruta.startsWith(r.ruta + '/') || ruta === r.ruta + '/')
    );
    const acceso = regla ? regla.acceso : metodo === 'GET' ? lectura : escritura;

    if (acceso === 'public') return optionalAuth(req, res, next);
    if (!acceso) return res.status(403).json({ message: 'Operación no permitida' });
    return authenticateToken(req, res, (err) => {
      if (err) return next(err);
      if (acceso === 'auth') return next();
      return requireRole(acceso)(req, res, next);
    });
  };
}

module.exports = { politica };
