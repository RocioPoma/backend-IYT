const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

const config = require('./config');
const connection = require('./connection');
const storage = require('./services/storage');
const { politica } = require('./services/politica');
const { GRUPOS } = require('./services/checkRole');

const app = express();
app.set('trust proxy', 1); // detrás de Render / Nginx
app.disable('x-powered-by');

//------------ Middleware general ------------
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(compression()); // respuestas comprimidas: más rápido en conexiones lentas
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || config.corsOrigenes.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
if (config.entorno !== 'test') app.use(morgan(config.entorno === 'production' ? 'tiny' : 'dev'));

//------------ Estado del servicio ------------
app.get('/', (req, res) => res.send('El Servidor Responde Bien'));
app.get('/health', async (req, res) => {
  const estado = { api: 'ok', db: 'error', archivos: 'error', almacenamiento: storage.tipo };
  try { await connection.verificarConexion(); estado.db = 'ok'; } catch (_) { /* */ }
  try { await storage.verificar(); estado.archivos = 'ok'; } catch (_) { /* */ }
  const ok = estado.db === 'ok' && estado.archivos === 'ok';
  res.status(ok ? 200 : 503).json(estado);
});

//------------ Archivos (fotos, logos, PDF) desde el servidor de archivos ------------
app.use('/uploads', require('./routes/archivos'));

//------------ Módulos con su política de acceso ------------
// lectura: 'public' (RF01: fixture, tabla, ranking, noticias, campos de juego, medallero), 'auth' o lista de roles
// escritura: lista de roles que pueden crear/modificar/eliminar
const modulos = [
  ['/user', 'user', null], // la ruta de usuarios define su propia seguridad
  ['/dashboard', 'dashboard', { lectura: 'auth', escritura: null }],
  ['/club', 'club', { lectura: 'public', escritura: GRUPOS.GESTION }],
  ['/jugador', 'jugador', { lectura: 'auth', escritura: GRUPOS.GESTION }],
  ['/campeonato', 'campeonato', { lectura: 'public', escritura: GRUPOS.GESTION }],
  ['/dcampeonato', 'detallecampeonato', { lectura: 'public', escritura: null }],
  ['/dcategoriacampeonato', 'dcategoriascampeonato', { lectura: 'public', escritura: GRUPOS.GESTION }],
  ['/disciplina', 'disciplina', { lectura: 'public', escritura: GRUPOS.GESTION }],
  ['/categoria', 'categoria', { lectura: 'public', escritura: GRUPOS.GESTION }],
  ['/serie', 'serie', { lectura: 'public', escritura: GRUPOS.GESTION }],
  ['/arbitro', 'arbitro', { lectura: 'auth', escritura: GRUPOS.GESTION }],
  ['/cancha', 'cancha', { lectura: 'public', escritura: GRUPOS.GESTION }],
  ['/noticia', 'noticia', { lectura: 'public', escritura: GRUPOS.NOTICIAS }],
  ['/reglamento', 'reglamento', { lectura: 'auth', escritura: GRUPOS.NORMAS }],
  ['/auspiciador', 'auspiciador', { lectura: 'public', escritura: GRUPOS.AUSPICIO }],
  ['/pase', 'pase_jugador', { lectura: 'auth', escritura: GRUPOS.GESTION }],
  ['/equipo', 'equipo', { lectura: 'public', escritura: GRUPOS.EQUIPOS }],
  ['/equipojugador', 'equipo_jugador', {
    lectura: 'auth',
    escritura: GRUPOS.EQUIPOS,
    // Poner jugadores en cancha / banca es parte de administrar el partido
    reglas: { 'PATCH /updateEstado': GRUPOS.PARTIDOS },
  }],
  ['/partido', 'partido', { lectura: 'public', escritura: GRUPOS.PARTIDOS }],
  ['/hechospartido', 'hechos_partido', {
    lectura: 'public',
    escritura: GRUPOS.PARTIDOS,
    reglas: { 'GET /getJugadorEnBanca': 'auth', 'GET /get': 'auth' },
  }],
  ['/medallero', 'medallero', { lectura: 'public', escritura: GRUPOS.PARTIDOS }],
];

for (const [ruta, archivo, opciones] of modulos) {
  const router = require(`./routes/${archivo}`);
  if (opciones) app.use(ruta, politica(opciones), router);
  else app.use(ruta, router);
}

//------------ 404 ------------
app.use((req, res) => res.status(404).json({ message: 'Ruta no encontrada' }));

//------------ Manejo de errores ------------
// Nunca se envían al navegador los detalles internos de la base de datos.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  if (status < 500) return res.status(status).json({ message: err.message });

  const mensajes = {
    ER_DUP_ENTRY: 'Ya existe un registro con esos datos',
    ER_ROW_IS_REFERENCED_2: 'No se puede eliminar porque tiene registros relacionados',
    ER_ROW_IS_REFERENCED: 'No se puede eliminar porque tiene registros relacionados',
    ER_NO_REFERENCED_ROW_2: 'Uno de los datos seleccionados no existe',
    ER_BAD_NULL_ERROR: 'Faltan datos obligatorios',
    ER_DATA_TOO_LONG: 'Uno de los datos es demasiado largo',
    ER_TRUNCATED_WRONG_VALUE: 'Uno de los datos tiene un formato inválido',
    ER_TRUNCATED_WRONG_VALUE_FOR_FIELD: 'Uno de los datos tiene un formato inválido',
  };
  if (mensajes[err.code]) return res.status(400).json({ message: mensajes[err.code] });

  console.error(`[error] ${req.method} ${req.originalUrl}:`, err);
  res.status(500).json({ message: 'Algo salió mal. Por favor, inténtelo de nuevo más tarde' });
});

module.exports = app;
