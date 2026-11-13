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
  .catch(() => { connection.cerrar().finally(() => process.exit(1)); });
