// Aplica las migraciones de database/migrations en orden, una sola vez cada una.
// Uso: npm run migrate
const fs = require('fs');
const path = require('path');
const connection = require('../connection');

// Errores que significan "ya estaba aplicado": se omiten para que sea seguro re-ejecutar
const YA_EXISTE = new Set(['ER_DUP_FIELDNAME', 'ER_DUP_KEYNAME', 'ER_TABLE_EXISTS_ERROR', 'ER_FK_DUP_NAME', 'ER_DUP_KEY']);

function sentencias(sql) {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.replace(/^\s*--.*$/gm, '').trim())
    .filter(Boolean);
}

async function main() {
  const db = connection.consulta;
  await db(`CREATE TABLE IF NOT EXISTS schema_migrations (
    nombre VARCHAR(200) PRIMARY KEY,
    aplicada DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  const hechas = new Set((await db('SELECT nombre FROM schema_migrations')).map((f) => f.nombre));
  const dir = path.join(__dirname, 'migrations');
  const archivos = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

  for (const archivo of archivos) {
    if (hechas.has(archivo)) {
      console.log(`✔ ${archivo} (ya aplicada)`);
      continue;
    }
    console.log(`→ Aplicando ${archivo}`);
    for (const s of sentencias(fs.readFileSync(path.join(dir, archivo), 'utf8'))) {
      try {
        await db(s);
      } catch (e) {
        if (YA_EXISTE.has(e.code)) {
          console.log(`   (omitido, ya existe) ${s.split('\n')[0].slice(0, 90)}`);
          continue;
        }
        console.error(`   ✖ Error en: ${s.slice(0, 200)}\n     ${e.code}: ${e.sqlMessage || e.message}`);
        throw e;
      }
    }
    await db('INSERT INTO schema_migrations (nombre) VALUES (?)', [archivo]);
    console.log(`✔ ${archivo}`);
  }
}

main()
  .then(() => { console.log('Migraciones completas.'); return connection.cerrar(); })
  .catch((e) => {
    // Mostrar siempre el motivo (antes los errores de conexión no se veían)
    const ayuda = {
      ECONNREFUSED: 'No se pudo conectar al servidor MySQL (¿IP/puerto correctos? ¿el puerto 3306 está abierto?).',
      ETIMEDOUT: 'Tiempo de espera agotado al conectar con MySQL (¿firewall o servidor apagado?).',
      ER_ACCESS_DENIED_ERROR: 'Usuario o contraseña de MySQL incorrectos (DB_USER / DB_PASSWORD), o falta DB_SSL=true si el servidor exige conexión cifrada.',
      ER_DBACCESS_DENIED_ERROR: 'El usuario no tiene permiso sobre esa base de datos. Ejecute: GRANT ALL ON <base>.* TO \'<usuario>\'@\'%\';',
      ER_BAD_DB_ERROR: 'La base de datos indicada en DB_NAME no existe.',
    };
    console.error(`\n✖ La migración falló: ${e.code || ''} ${e.sqlMessage || e.message}`);
    if (ayuda[e.code]) console.error(`  → ${ayuda[e.code]}`);
    connection.cerrar().finally(() => process.exit(1));
  });
