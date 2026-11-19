const http = require('http');
const config = require('./config');
const app = require('./index');
const connection = require('./connection');
const storage = require('./services/storage');

const server = http.createServer(app);
server.keepAliveTimeout = 65000; // mayor que el del proxy (Nginx/Render)
server.headersTimeout = 66000;

server.listen(config.puerto, async () => {
  console.log(`API escuchando en el puerto ${config.puerto} (${config.entorno})`);
  try {
    await connection.verificarConexion();
    console.log('Base de datos: conectada');
  } catch (e) {
    console.error('Base de datos: ERROR al conectar ->', e.code || e.message);
  }
  try {
    await storage.verificar();
    console.log(`Archivos: ${storage.tipo} OK`);
  } catch (e) {
    console.error(`Archivos: ERROR en almacenamiento ${storage.tipo} ->`, e.name || e.message);
  }
});

function apagar(senal) {
  console.log(`${senal} recibido, cerrando...`);
  server.close(() => {
    connection.cerrar().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => apagar('SIGTERM'));
process.on('SIGINT', () => apagar('SIGINT'));
process.on('unhandledRejection', (e) => console.error('[unhandledRejection]', e));
