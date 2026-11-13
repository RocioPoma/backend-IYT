// Sube al servidor de archivos (S3) todos los archivos de una carpeta local (por defecto uploads/img)
// y muestra qué archivos referenciados en la base de datos no se encontraron.
// Uso:  STORAGE_DRIVER=s3 npm run archivos:migrar -- [carpeta]
const fs = require('fs');
const path = require('path');
const config = require('../config');
const storage = require('../services/storage');
const connection = require('../connection');

const TIPOS = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.pdf': 'application/pdf' };

async function main() {
  if (storage.tipo !== 's3') {
    console.error('Configure STORAGE_DRIVER=s3 y las variables S3_* en el .env antes de migrar.');
    process.exit(1);
  }
  const carpeta = path.resolve(process.argv[2] || path.join(config.almacenamiento.carpetaLocal, 'img'));
  const archivos = fs.existsSync(carpeta) ? fs.readdirSync(carpeta).filter((f) => fs.statSync(path.join(carpeta, f)).isFile()) : [];
  console.log(`Subiendo ${archivos.length} archivos desde ${carpeta} ...`);
  let subidos = 0;
  for (const nombre of archivos) {
    const ext = path.extname(nombre).toLowerCase();
    await storage.guardar(storage.clave(nombre), fs.readFileSync(path.join(carpeta, nombre)), TIPOS[ext]);
    subidos++;
    process.stdout.write(`\r  ${subidos}/${archivos.length}`);
  }
  console.log(`\n✔ ${subidos} archivos subidos.`);

  const referencias = await connection.consulta(`
    SELECT 'jugador.foto' AS origen, foto AS archivo FROM jugador WHERE foto <> ''
    UNION ALL SELECT 'jugador.documento', documento FROM jugador WHERE documento <> ''
    UNION ALL SELECT 'campeonato.convocatoria', convocatoria FROM campeonato WHERE convocatoria <> ''
    UNION ALL SELECT 'noticia.imagen', imagen FROM noticia WHERE imagen <> ''
    UNION ALL SELECT 'reglamento.documento', documento FROM reglamento WHERE documento <> ''
    UNION ALL SELECT 'pase_jugador.documento', documento FROM pase_jugador WHERE documento <> ''
    UNION ALL SELECT 'club.logo', logo FROM club WHERE logo <> ''`);
  const faltan = [];
  for (const r of referencias) {
    if (!r.archivo) continue;
    if (!(await storage.existe(storage.clave(r.archivo)))) faltan.push(r);
  }
  if (faltan.length) {
    console.log(`\n⚠ ${faltan.length} archivos están en la base de datos pero no se encontraron:`);
    for (const f of faltan) console.log(`   ${f.origen}: ${f.archivo}`);
  } else {
    console.log('✔ Todos los archivos referenciados en la base de datos existen en el servidor de archivos.');
  }
}

main()
  .catch((e) => { console.error('Error:', e.message); process.exitCode = 1; })
  .finally(() => connection.cerrar());
