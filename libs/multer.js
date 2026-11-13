// Subida de archivos: multer recibe el archivo en memoria y luego se guarda en el servidor de archivos.
// Uso en las rutas (igual que antes): multer.single('foto')  →  req.file.filename queda con el nombre guardado.
const multer = require('multer');
const path = require('path');
const config = require('../config');
const storage = require('../services/storage');

const TIPOS_PERMITIDOS = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
]);

const subida = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.almacenamiento.tamanoMaximoMB * 1024 * 1024, files: 5 },
  fileFilter: (req, file, cb) => {
    if (TIPOS_PERMITIDOS.has(file.mimetype)) return cb(null, true);
    const err = new Error('Tipo de archivo no permitido. Solo imágenes (JPG, PNG, WEBP, GIF) o PDF.');
    err.status = 400;
    cb(err);
  },
});

function nombreSeguro(original) {
  // multer entrega el nombre en latin1; lo pasamos a utf8 y quitamos caracteres problemáticos
  let nombre = Buffer.from(original || 'archivo', 'latin1').toString('utf8');
  const ext = path.extname(nombre).toLowerCase().replace(/[^.a-z0-9]/g, '');
  const base = path
    .basename(nombre, path.extname(nombre))
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
  return `${Date.now()}-${base || 'archivo'}${ext}`;
}

async function persistir(file) {
  file.filename = nombreSeguro(file.originalname);
  await storage.guardar(storage.clave(file.filename), file.buffer, file.mimetype);
  file.buffer = undefined;
}

function manejarError(err, next) {
  if (err instanceof multer.MulterError) {
    err.status = 400;
    if (err.code === 'LIMIT_FILE_SIZE') err.message = `El archivo supera el máximo de ${config.almacenamiento.tamanoMaximoMB} MB`;
  }
  next(err);
}

module.exports = {
  single(campo) {
    return [
      (req, res, next) => subida.single(campo)(req, res, (err) => (err ? manejarError(err, next) : next())),
      async (req, res, next) => {
        try {
          if (req.file) await persistir(req.file);
          next();
        } catch (e) {
          next(e);
        }
      },
    ];
  },
  array(campo, max = 5) {
    return [
      (req, res, next) => subida.array(campo, max)(req, res, (err) => (err ? manejarError(err, next) : next())),
      async (req, res, next) => {
        try {
          for (const f of req.files || []) await persistir(f);
          next();
        } catch (e) {
          next(e);
        }
      },
    ];
  },
};
