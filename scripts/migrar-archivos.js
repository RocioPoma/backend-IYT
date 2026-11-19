// Sube al servidor de archivos (S3) todos los archivos de una carpeta local (por defecto uploads/img)
// y muestra qué archivos referenciados en la base de datos no se encontraron.
// Uso:  STORAGE_DRIVER=s3 npm run archivos:migrar -- [carpeta] [--descargar-de=URL]
//   --descargar-de=https://backend-iyt.onrender.com/uploads/img/
//     descarga del servidor antiguo los archivos que faltan (por ejemplo los que solo existían en Render)
const fs = require('fs');
const path = require('path');
const config = require('../config');
const storage = require('../services/storage');
const connection = require('../connection');

// Nunca se copian programas ejecutables (no son documentos válidos del sistema)
const BLOQUEADAS = new Set(['.exe', '.bat', '.cmd', '.msi', '.com', '.scr', '.dll', '.js', '.sh', '.ps1', '.vbs', '.jar', '.apk']);

const TIPOS = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.pdf': 'application/pdf' };

async function main() {
  if (storage.tipo !== 's3') {
    console.error('Configure STORAGE_DRIVER=s3 y las variables S3_* en el .env antes de migrar.');
    process.exit(1);
  }
  const args = process.argv.slice(2);
  const opcion = args.find((a) => a.startsWith('--descargar-de='));
  const origenUrl = opcion ? opcion.slice('--descargar-de='.length).replace(/\/?$/, '/') : null;
  const carpeta = path.resolve(args.find((a) => !a.startsWith('--')) || path.join(config.almacenamiento.carpetaLocal, 'img'));
  const archivos = fs.existsSync(carpeta) ? fs.readdirSync(carpeta).filter((f) => fs.statSync(path.join(carpeta, f)).isFile()) : [];
  console.log(`Subiendo ${archivos.length} archivos desde ${carpeta} ...`);
  let subidos = 0;
  for (const nombre of archivos) {
    const ext = path.extname(nombre).toLowerCase();
    if (BLOQUEADAS.has(ext)) { console.log(`\n  (omitido, ejecutable) ${nombre}`); continue; }
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
  let faltan = [];
  for (const r of referencias) {
    if (!r.archivo) continue;
    if (!(await storage.existe(storage.clave(r.archivo)))) faltan.push(r);
  }

  // Descargar del servidor antiguo los que faltan
  if (origenUrl && faltan.length) {
    console.log(`\nDescargando ${faltan.length} archivos desde ${origenUrl} ...`);
    const siguen = [];
    let bajados = 0;
    for (const f of faltan) {
      const ext = path.extname(f.archivo).toLowerCase();
      if (BLOQUEADAS.has(ext)) { console.log(`  (omitido, ejecutable) ${f.archivo}`); siguen.push(f); continue; }
      try {
        const r = await fetch(origenUrl + encodeURIComponent(f.archivo));
        if (!r.ok) { siguen.push(f); continue; }
        const datos = Buffer.from(await r.arrayBuffer());
        await storage.guardar(storage.clave(f.archivo), datos, TIPOS[ext] || r.headers.get('content-type') || undefined);
        bajados++;
        process.stdout.write(`\r  ${bajados} descargados`);
      } catch (_) {
        siguen.push(f);
      }
    }
    console.log(`\n✔ ${bajados} archivos recuperados del servidor antiguo.`);
    faltan = siguen;
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
