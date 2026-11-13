// Configuración central: todo sale de variables de entorno (.env en local, panel de Render/servidor en producción).
require('dotenv').config({ quiet: true });

function requerida(nombre) {
  const valor = process.env[nombre];
  if (valor === undefined || valor === '') {
    throw new Error(`Falta la variable de entorno ${nombre}. Revisa tu archivo .env (ver .env.example).`);
  }
  return valor;
}

function booleano(nombre, porDefecto = false) {
  const v = process.env[nombre];
  if (v === undefined || v === '') return porDefecto;
  return ['1', 'true', 'si', 'yes'].includes(String(v).toLowerCase());
}

const config = {
  entorno: process.env.NODE_ENV || 'development',
  puerto: Number(process.env.PORT || 4000),

  // Orígenes permitidos para CORS, separados por coma
  corsOrigenes: (process.env.CORS_ORIGINS || 'http://localhost:4200')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  // URL pública del frontend (para enlaces en correos)
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:4200',

  db: {
    host: requerida('DB_HOST'),
    port: Number(process.env.DB_PORT || 3306),
    user: requerida('DB_USER'),
    password: requerida('DB_PASSWORD'),
    database: requerida('DB_NAME'),
    ssl: booleano('DB_SSL', false),
    connectionLimit: Number(process.env.DB_POOL || 15),
  },

  jwt: {
    secreto: requerida('JWT_SECRET'),
    // Requisito 3.3.2: la sesión inactiva por 30 minutos debe volver a autenticarse.
    // El frontend renueva el token mientras el usuario está activo.
    duracion: process.env.JWT_EXPIRES || '30m',
  },

  // Almacenamiento de archivos: "s3" (servidor de archivos) o "local" (solo para desarrollo)
  almacenamiento: {
    tipo: (process.env.STORAGE_DRIVER || 'local').toLowerCase(),
    s3: {
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION || 'us-east-1',
      bucket: process.env.S3_BUCKET,
      accessKeyId: process.env.S3_ACCESS_KEY,
      secretAccessKey: process.env.S3_SECRET_KEY,
      forcePathStyle: booleano('S3_FORCE_PATH_STYLE', true),
    },
    carpetaLocal: process.env.LOCAL_STORAGE_DIR || 'uploads',
    tamanoMaximoMB: Number(process.env.MAX_UPLOAD_MB || 10),
  },

  correo: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: booleano('SMTP_SECURE', false),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    remitente: process.env.SMTP_FROM || process.env.SMTP_USER,
  },
};

if (config.almacenamiento.tipo === 's3') {
  for (const k of ['endpoint', 'bucket', 'accessKeyId', 'secretAccessKey']) {
    if (!config.almacenamiento.s3[k]) {
      throw new Error(`STORAGE_DRIVER=s3 requiere S3_${k === 'accessKeyId' ? 'ACCESS_KEY' : k === 'secretAccessKey' ? 'SECRET_KEY' : k.toUpperCase()}`);
    }
  }
}

if (config.entorno === 'production' && config.almacenamiento.tipo !== 's3') {
  console.warn('⚠ ATENCIÓN: en producción los archivos deben ir al servidor de archivos (STORAGE_DRIVER=s3). ' +
    'En Render el disco local se borra en cada despliegue.');
}

if (config.entorno === 'production' && config.jwt.secreto.length < 32) {
  throw new Error('JWT_SECRET debe tener al menos 32 caracteres en producción.');
}

module.exports = config;
