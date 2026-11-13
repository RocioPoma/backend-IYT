// Almacenamiento de archivos (fotos, logos, convocatorias, documentos).
// - "s3": servidor de archivos compatible con S3 (SeaweedFS/Garage en Contabo, Contabo Object Storage, etc.)
// - "local": carpeta en disco, solo para desarrollo.
// El backend siempre es quien lee y entrega los archivos: el bucket no necesita ser público.
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { Readable } = require('stream');
const config = require('../config');

function validarClave(clave) {
  if (typeof clave !== 'string' || !clave || clave.includes('..') || clave.startsWith('/') || clave.includes('\\')) {
    throw new Error('Nombre de archivo inválido');
  }
  return clave;
}

function crearLocal() {
  const base = path.resolve(config.almacenamiento.carpetaLocal);
  const ruta = (clave) => path.join(base, validarClave(clave));
  return {
    tipo: 'local',
    async guardar(clave, buffer) {
      const destino = ruta(clave);
      await fsp.mkdir(path.dirname(destino), { recursive: true });
      await fsp.writeFile(destino, buffer);
    },
    async obtener(clave) {
      const origen = ruta(clave);
      try {
        const st = await fsp.stat(origen);
        return { cuerpo: fs.createReadStream(origen), tamano: st.size, tipoContenido: null };
      } catch (e) {
        if (e.code === 'ENOENT') return null;
        throw e;
      }
    },
    async eliminar(clave) {
      await fsp.rm(ruta(clave), { force: true });
    },
    async existe(clave) {
      try { await fsp.stat(ruta(clave)); return true; } catch (_) { return false; }
    },
    async verificar() {
      await fsp.mkdir(base, { recursive: true });
      return true;
    },
  };
}

function crearS3() {
  const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadBucketCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
  const c = config.almacenamiento.s3;
  const cliente = new S3Client({
    endpoint: c.endpoint,
    region: c.region,
    forcePathStyle: c.forcePathStyle,
    credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
    // Los servidores S3 autoalojados no siempre soportan las sumas de verificación nuevas del SDK
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
  return {
    tipo: 's3',
    cliente,
    async guardar(clave, buffer, tipoContenido) {
      await cliente.send(
        new PutObjectCommand({ Bucket: c.bucket, Key: validarClave(clave), Body: buffer, ContentType: tipoContenido || 'application/octet-stream' })
      );
    },
    async obtener(clave) {
      try {
        const r = await cliente.send(new GetObjectCommand({ Bucket: c.bucket, Key: validarClave(clave) }));
        const cuerpo = r.Body instanceof Readable ? r.Body : Readable.fromWeb(r.Body.transformToWebStream());
        return { cuerpo, tamano: r.ContentLength, tipoContenido: r.ContentType };
      } catch (e) {
        if (e.name === 'NoSuchKey' || e.$metadata?.httpStatusCode === 404) return null;
        throw e;
      }
    },
    async eliminar(clave) {
      await cliente.send(new DeleteObjectCommand({ Bucket: c.bucket, Key: validarClave(clave) }));
    },
    async existe(clave) {
      try {
        await cliente.send(new HeadObjectCommand({ Bucket: c.bucket, Key: validarClave(clave) }));
        return true;
      } catch (e) {
        if (e.name === 'NotFound' || e.$metadata?.httpStatusCode === 404) return false;
        throw e;
      }
    },
    async verificar() {
      await cliente.send(new HeadBucketCommand({ Bucket: c.bucket }));
      return true;
    },
  };
}

const storage = config.almacenamiento.tipo === 's3' ? crearS3() : crearLocal();

/** Clave de un archivo subido (todos los archivos históricos viven en "img/"). */
storage.clave = (nombre) => `img/${nombre}`;

/** Elimina un archivo sin interrumpir la operación si falla. */
storage.eliminarSeguro = async (nombre) => {
  if (!nombre) return;
  try {
    await storage.eliminar(storage.clave(nombre));
  } catch (e) {
    console.warn('[storage] No se pudo eliminar', nombre, e.message);
  }
};

module.exports = storage;
