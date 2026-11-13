// Usuarios: listar, registrar, editar, eliminar, activar/desactivar, login, cambio y recuperación de contraseña.
// Las contraseñas se guardan cifradas con bcrypt (requisito 3.3.2).
const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const connection = require('../connection');
const { authenticateToken, optionalAuth, firmar } = require('../services/authentication');
const { requireRole, ROLES, rolValido } = require('../services/checkRole');
const correo = require('../services/correo');
const config = require('../config');

const router = express.Router();
const db = connection.consulta;
const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const RONDAS_BCRYPT = 10;
const esHashBcrypt = (v) => typeof v === 'string' && /^\$2[aby]\$\d{2}\$/.test(v);
const MIN_CLAVE = 6;

// Límite de intentos para evitar ataques de fuerza bruta en el login
const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Demasiados intentos. Espere unos minutos e intente de nuevo.' },
});

function normalizarEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function datosToken(u) {
  return { id: u.id, nombre: u.name, email: u.email, role: u.role, id_club: u.id_club };
}

/** Compara la contraseña; si en la BD estaba en texto plano (usuarios antiguos) la cifra en ese momento. */
async function verificarClave(usuario, clave) {
  if (!usuario || !usuario.password || !clave) return false;
  if (esHashBcrypt(usuario.password)) return bcrypt.compare(String(clave), usuario.password);
  // Usuario antiguo con contraseña sin cifrar
  const a = Buffer.from(String(usuario.password));
  const b = Buffer.from(String(clave));
  const igual = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (igual) {
    const hash = await bcrypt.hash(String(clave), RONDAS_BCRYPT);
    await db('UPDATE user SET password=? WHERE id=?', [hash, usuario.id]);
  }
  return igual;
}

function validarUsuario(u, { claveObligatoria }) {
  if (!u.name || String(u.name).trim().length < 3) return 'El nombre es obligatorio (mínimo 3 caracteres)';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizarEmail(u.email))) return 'Correo electrónico inválido';
  if (claveObligatoria && (!u.password || String(u.password).length < MIN_CLAVE)) {
    return `La contraseña debe tener al menos ${MIN_CLAVE} caracteres`;
  }
  if (u.password && String(u.password).length < MIN_CLAVE) return `La contraseña debe tener al menos ${MIN_CLAVE} caracteres`;
  return null;
}

//------------ LISTAR USUARIOS (RF02.1) — solo administrador ------------
router.get('/get', authenticateToken, requireRole(ROLES.ADMIN), h(async (req, res) => {
  const filas = await db(`
    SELECT u.id, u.name, u.email, u.contactNumber, u.status, u.role, u.fecha_registro,
           c.nombre AS NombreClub, c.id AS clubId
    FROM user u
    LEFT JOIN club c ON u.id_club = c.id
    ORDER BY u.name`);
  res.status(200).json(filas);
}));

//------------ REGISTRAR USUARIO (RF02.2) ------------
// - Si lo hace el administrador (con sesión): puede elegir rol y queda activo.
// - Si es un registro público: queda como "delegado" y pendiente de aprobación del administrador (req. 3.3.2).
router.post('/signup', optionalAuth, h(async (req, res) => {
  const u = req.body || {};
  const error = validarUsuario(u, { claveObligatoria: true });
  if (error) return res.status(400).json({ message: error });

  const esAdmin = req.usuario && req.usuario.role === ROLES.ADMIN;
  const email = normalizarEmail(u.email);
  const existe = await db('SELECT id FROM user WHERE email=?', [email]);
  if (existe.length > 0) return res.status(400).json({ message: 'Alguien se encuentra registrado con el mismo correo' });

  let rol = ROLES.DELEGADO;
  if (esAdmin) {
    rol = u.role === 'user' ? ROLES.DELEGADO : u.role;
    if (!rolValido(rol)) return res.status(400).json({ message: 'Rol inválido' });
  }
  const estado = esAdmin ? 'true' : 'false';
  const hash = await bcrypt.hash(String(u.password), RONDAS_BCRYPT);
  const clubId = u.clubId || u.id_club || null;

  await db(
    `INSERT INTO user (name, contactNumber, email, password, status, role, id_club, fecha_registro)
     VALUES (?, ?, ?, ?, ?, ?, ?, CURDATE())`,
    [String(u.name).trim(), u.contactNumber || null, email, hash, estado, rol, clubId]
  );
  res.status(200).json({
    message: esAdmin ? 'Registro Exitoso' : 'Registro exitoso. Espere la aprobación del administrador para ingresar.',
  });
}));

//------------ MODIFICAR USUARIO (RF02.3) — solo administrador ------------
// Si la contraseña viene vacía, se conserva la actual.
router.patch('/update', authenticateToken, requireRole(ROLES.ADMIN), h(async (req, res) => {
  const u = req.body || {};
  const error = validarUsuario(u, { claveObligatoria: false });
  if (error) return res.status(400).json({ message: error });
  const rol = u.role === 'user' ? ROLES.DELEGADO : u.role;
  if (!rolValido(rol)) return res.status(400).json({ message: 'Rol inválido' });

  const email = normalizarEmail(u.email);
  const duplicado = await db('SELECT id FROM user WHERE email=? AND id<>?', [email, u.id]);
  if (duplicado.length) return res.status(400).json({ message: 'Ya existe otro usuario con ese correo' });

  const campos = ['name=?', 'contactNumber=?', 'email=?', 'role=?', 'id_club=?'];
  const valores = [String(u.name).trim(), u.contactNumber || null, email, rol, u.clubId || u.id_club || null];
  if (u.password && !esHashBcrypt(u.password)) {
    campos.push('password=?');
    valores.push(await bcrypt.hash(String(u.password), RONDAS_BCRYPT));
  }
  valores.push(u.id);
  const r = await db(`UPDATE user SET ${campos.join(', ')} WHERE id=?`, valores);
  if (r.affectedRows === 0) return res.status(404).json({ message: 'Usuario Id no encontrado' });
  res.status(200).json({ message: 'Usuario actualizado con exito' });
}));

//------------ LOGIN (RF01) ------------
router.post('/login', limiteLogin, h(async (req, res) => {
  const { email, password } = req.body || {};
  const filas = await db('SELECT id, name, email, password, role, id_club, status FROM user WHERE email=?', [normalizarEmail(email)]);
  const usuario = filas[0];
  const valido = await verificarClave(usuario, password);
  if (!valido) return res.status(401).json({ message: 'Nombre de usuario o contraseña incorrecta' });
  if (usuario.status !== 'true') return res.status(401).json({ message: 'Esperar la aprobación del administrador' });

  const rol = usuario.role === 'user' ? ROLES.DELEGADO : usuario.role;
  const token = firmar(datosToken({ ...usuario, role: rol }));
  res.status(200).json({ token, data: { nombre: usuario.name, role: rol, id_club: usuario.id_club } });
}));

//------------ RENOVAR SESIÓN ------------
// El frontend la llama mientras el usuario está activo; tras 30 min sin actividad el token expira (req. 3.3.2).
router.post('/refresh', authenticateToken, h(async (req, res) => {
  const filas = await db('SELECT id, name, email, role, id_club, status FROM user WHERE id=?', [req.usuario.id]);
  const u = filas[0];
  if (!u || u.status !== 'true') return res.status(401).json({ message: 'Usuario deshabilitado' });
  const rol = u.role === 'user' ? ROLES.DELEGADO : u.role;
  res.status(200).json({ token: firmar(datosToken({ ...u, role: rol })) });
}));

//------------ OLVIDÉ MI CONTRASEÑA ------------
// Ya no se envía la contraseña por correo: se envía un enlace de un solo uso válido por 1 hora.
router.post('/forgotPassword', limiteLogin, h(async (req, res) => {
  const email = normalizarEmail(req.body && req.body.email);
  const respuesta = { message: 'Si el correo está registrado, recibirá un enlace para restablecer su contraseña.' };
  const filas = await db('SELECT id, name, email FROM user WHERE email=?', [email]);
  if (!filas.length) return res.status(200).json(respuesta);

  const token = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  await db('UPDATE user SET reset_token=?, reset_expira=DATE_ADD(NOW(), INTERVAL 1 HOUR) WHERE id=?', [hash, filas[0].id]);

  const enlace = `${config.frontendUrl.replace(/\/$/, '')}/restablecer?token=${token}`;
  try {
    await correo.enviar({
      para: filas[0].email,
      asunto: 'Restablecer contraseña - Integración Yaretanense',
      html: `<p>Hola ${filas[0].name || ''},</p>
             <p>Recibimos una solicitud para restablecer su contraseña. Use este enlace (válido por 1 hora):</p>
             <p><a href="${enlace}">${enlace}</a></p>
             <p>Si usted no lo solicitó, ignore este correo.</p>`,
    });
  } catch (e) {
    console.error('[correo] No se pudo enviar el correo de recuperación:', e.message);
  }
  res.status(200).json(respuesta);
}));

router.post('/resetPassword', limiteLogin, h(async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password || String(password).length < MIN_CLAVE) {
    return res.status(400).json({ message: `La contraseña debe tener al menos ${MIN_CLAVE} caracteres` });
  }
  const hash = crypto.createHash('sha256').update(String(token)).digest('hex');
  const filas = await db('SELECT id FROM user WHERE reset_token=? AND reset_expira > NOW()', [hash]);
  if (!filas.length) return res.status(400).json({ message: 'El enlace no es válido o ya expiró' });
  const nueva = await bcrypt.hash(String(password), RONDAS_BCRYPT);
  await db('UPDATE user SET password=?, reset_token=NULL, reset_expira=NULL WHERE id=?', [nueva, filas[0].id]);
  res.status(200).json({ message: 'Contraseña actualizada. Ya puede iniciar sesión.' });
}));

//------------ ACTIVAR / DESACTIVAR USUARIO (RF02.6) ------------
router.patch('/updateStatus', authenticateToken, requireRole(ROLES.ADMIN), h(async (req, res) => {
  const { status, id } = req.body || {};
  const estado = String(status) === 'true' ? 'true' : 'false';
  if (Number(id) === Number(req.usuario.id) && estado === 'false') {
    return res.status(400).json({ message: 'No puede desactivar su propio usuario' });
  }
  const r = await db('UPDATE user SET status=? WHERE id=?', [estado, id]);
  if (r.affectedRows === 0) return res.status(404).json({ message: 'El usuario  no existe' });
  res.status(200).json({ message: 'Actualización Estado de usuario con éxito' });
}));

//------------ ELIMINAR USUARIO (RF02.4) ------------
router.delete('/delete/:id', authenticateToken, requireRole(ROLES.ADMIN), h(async (req, res) => {
  if (Number(req.params.id) === Number(req.usuario.id)) {
    return res.status(400).json({ message: 'No puede eliminar su propio usuario' });
  }
  const r = await db('DELETE FROM user WHERE id=?', [req.params.id]);
  if (r.affectedRows === 0) return res.status(404).json({ message: 'Usuario Id no encontrado' });
  res.status(200).json({ message: 'Usuario eliminado con éxito' });
}));

//------------ VERIFICAR TOKEN ------------
router.get('/checktoken', authenticateToken, (req, res) => res.status(200).json({ message: 'true' }));

//------------ CAMBIAR CONTRASEÑA (RF02.9) ------------
router.post('/changePassword', authenticateToken, h(async (req, res) => {
  const { oldPassword, newPassword } = req.body || {};
  if (!newPassword || String(newPassword).length < MIN_CLAVE) {
    return res.status(400).json({ message: `La nueva contraseña debe tener al menos ${MIN_CLAVE} caracteres` });
  }
  const filas = await db('SELECT id, password FROM user WHERE email=?', [req.usuario.email]);
  if (!(await verificarClave(filas[0], oldPassword))) return res.status(400).json({ message: 'Incorrect Old Password' });
  const hash = await bcrypt.hash(String(newPassword), RONDAS_BCRYPT);
  await db('UPDATE user SET password=? WHERE id=?', [hash, filas[0].id]);
  res.status(200).json({ message: 'Password Update Successfully.' });
}));

module.exports = router;
