// Entrega de archivos desde el servidor de archivos. Mantiene la URL histórica /uploads/img/<nombre>
// para que el frontend no tenga que cambiar.
// Los documentos personales (documento del jugador, hoja de pase) solo se entregan con sesión iniciada;
// como se abren en una pestaña nueva, el token puede ir en ?token=...
const express = require('express');
const path = require('path');
const connection = require('../connection');
const storage = require('../services/storage');
const { verificar } = require('../services/authentication');

const router = express.Router();

const TIPOS = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
};

async function esPrivado(nombre) {
  const filas = await connection.consulta(
    `SELECT 1 FROM jugador WHERE documento = ? UNION ALL SELECT 1 FROM pase_jugador WHERE documento = ? LIMIT 1`,
    [nombre, nombre]
  );
  return filas.length > 0;
}

function tieneSesion(req) {
  const cabecera = req.headers.authorization;
  const token = cabecera && cabecera.startsWith('Bearer ') ? cabecera.slice(7) : req.query.token;
  if (!token) return false;
  try {
    verificar(token);
    return true;
  } catch (_) {
    return false;
  }
}

router.get('/img/:nombre', async (req, res, next) => {
  try {
    const nombre = req.params.nombre;
    if (!nombre || nombre.includes('/') || nombre.includes('..')) return res.status(400).json({ message: 'Nombre inválido' });

    const privado = await esPrivado(nombre);
    if (privado && !tieneSesion(req)) return res.status(401).json({ message: 'Debe iniciar sesión para ver este documento' });

    const archivo = await storage.obtener(storage.clave(nombre));
    if (!archivo) return res.status(404).json({ message: 'Archivo no encontrado' });

    const tipo = archivo.tipoContenido && archivo.tipoContenido !== 'application/octet-stream'
      ? archivo.tipoContenido
      : TIPOS[path.extname(nombre).toLowerCase()] || 'application/octet-stream';
    res.setHeader('Content-Type', tipo);
    if (archivo.tamano) res.setHeader('Content-Length', archivo.tamano);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(nombre)}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Los nombres llevan marca de tiempo, nunca cambian: se pueden guardar en caché mucho tiempo
    res.setHeader('Cache-Control', privado ? 'private, no-store' : 'public, max-age=2592000, immutable');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    archivo.cuerpo.on('error', next);
    archivo.cuerpo.pipe(res);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
