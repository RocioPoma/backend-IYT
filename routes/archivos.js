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

// Miniaturas: /uploads/img/<nombre>?ancho=160 devuelve la imagen reducida (WEBP), generada una sola vez
// y guardada en el servidor de archivos. Así las listas no descargan fotos de varios MB.
const ANCHOS = [64, 128, 160, 320, 640];
const ES_IMAGEN = /\.(jpe?g|png|webp|gif)$/i;
let sharp = null;
try { sharp = require('sharp'); } catch (_) { sharp = null; }

async function aBuffer(stream) {
  const partes = [];
  for await (const p of stream) partes.push(p);
  return Buffer.concat(partes);
}

async function miniatura(nombre, ancho) {
  const clave = `min/${ancho}/${nombre}.webp`;
  const guardada = await storage.obtener(clave);
  if (guardada) return guardada;
  const original = await storage.obtener(storage.clave(nombre));
  if (!original) return null;
  const datos = await sharp(await aBuffer(original.cuerpo), { failOn: 'none' })
    .rotate() // respeta la orientación de las fotos de celular
    .resize({ width: ancho, height: ancho, fit: 'cover', withoutEnlargement: true })
    .webp({ quality: 78 })
    .toBuffer();
  await storage.guardar(clave, datos, 'image/webp').catch((e) => console.warn('[miniatura] no se guardó', e.message));
  return { cuerpo: require('stream').Readable.from(datos), tamano: datos.length, tipoContenido: 'image/webp' };
}

// Caché corta de "¿es privado?" para no consultar la base por cada foto de una lista
const cachePrivado = new Map();
async function esPrivadoCache(nombre) {
  const c = cachePrivado.get(nombre);
  if (c && c.hasta > Date.now()) return c.valor;
  const valor = await esPrivado(nombre);
  if (cachePrivado.size > 5000) cachePrivado.clear();
  cachePrivado.set(nombre, { valor, hasta: Date.now() + 60_000 });
  return valor;
}

async function esPrivado(nombre) {
  const filas = await connection.consulta(
    `SELECT 1 FROM jugador WHERE documento = ?
     UNION ALL SELECT 1 FROM pase_jugador WHERE documento = ?
     UNION ALL SELECT 1 FROM jugador_solicitud WHERE (documento = ? OR foto = ?) AND estado <> 'aprobado'
     LIMIT 1`,
    [nombre, nombre, nombre, nombre]
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

    const privado = await esPrivadoCache(nombre);
    if (privado && !tieneSesion(req)) return res.status(401).json({ message: 'Debe iniciar sesión para ver este documento' });

    const ancho = Number(req.query.ancho);
    const conMiniatura = sharp && !privado && ANCHOS.includes(ancho) && ES_IMAGEN.test(nombre);
    let archivo = null;
    if (conMiniatura) {
      try {
        archivo = await miniatura(nombre, ancho);
        if (archivo) archivo.tipoContenido = 'image/webp';
      } catch (e) { console.warn('[miniatura]', nombre, e.message); }
    }
    if (!archivo) archivo = await storage.obtener(storage.clave(nombre));
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
