// Envío de correos (recuperación de contraseña). Configurar SMTP_* en el .env.
const nodemailer = require('nodemailer');
const config = require('../config');

let transporte = null;

function obtenerTransporte() {
  if (transporte) return transporte;
  const c = config.correo;
  if (!c.host || !c.user || !c.pass) return null;
  transporte = nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure: c.secure,
    auth: { user: c.user, pass: c.pass },
  });
  return transporte;
}

async function enviar({ para, asunto, html }) {
  const t = obtenerTransporte();
  if (!t) {
    console.warn('[correo] SMTP no configurado; no se envió el correo a', para);
    return false;
  }
  await t.sendMail({ from: config.correo.remitente, to: para, subject: asunto, html });
  return true;
}

module.exports = { enviar };
