// Pool de conexiones MySQL. Exporta el pool con la API de callbacks (usada por las rutas existentes)
// y además `query()` basada en promesas para el código nuevo.
const mysql = require('mysql2');
const config = require('./config');

const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  connectionLimit: config.db.connectionLimit,
  waitForConnections: true,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  charset: 'utf8mb4',
  ssl: config.db.ssl ? { rejectUnauthorized: false } : undefined,
});

pool.on('error', (err) => {
  console.error('[db] Error en el pool de MySQL:', err.code || err.message);
});

const promesa = pool.promise();

/** Ejecuta una consulta y devuelve solo las filas/resultado. */
async function query(sql, params = []) {
  const [filas] = await promesa.query(sql, params);
  return filas;
}

/** Ejecuta varias operaciones dentro de una transacción. */
async function transaccion(fn) {
  const conn = await promesa.getConnection();
  try {
    await conn.beginTransaction();
    const resultado = await fn({
      query: async (sql, params = []) => (await conn.query(sql, params))[0],
    });
    await conn.commit();
    return resultado;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function verificarConexion() {
  const filas = await query('SELECT 1 AS ok');
  return filas[0].ok === 1;
}

// Importante: `pool.query` conserva la API de callbacks; el helper con promesas se llama `consulta`.
pool.consulta = query;
pool.transaccion = transaccion;
pool.verificarConexion = verificarConexion;
pool.cerrar = () => promesa.end();
module.exports = pool;
