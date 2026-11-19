// Utilidades para registros que tienen archivos asociados en el servidor de archivos.
const connection = require('../connection');
const storage = require('../services/storage');

/**
 * Elimina un registro y, solo si se eliminó, borra sus archivos del servidor de archivos.
 * (Antes se borraba el archivo primero; si la BD rechazaba la eliminación, el archivo se perdía.)
 */
async function eliminarConArchivos(tabla, columnaId, id, columnasArchivo) {
  const filas = await connection.consulta(
    `SELECT ${columnasArchivo.map((c) => '`' + c + '`').join(', ')} FROM \`${tabla}\` WHERE \`${columnaId}\` = ?`,
    [id]
  );
  const r = await connection.consulta(`DELETE FROM \`${tabla}\` WHERE \`${columnaId}\` = ?`, [id]);
  if (r.affectedRows > 0 && filas[0]) {
    for (const c of columnasArchivo) await storage.eliminarSeguro(filas[0][c]);
  }
  return r;
}

/** Al reemplazar un archivo en una edición, borra el anterior. */
async function reemplazarArchivo(anterior, nuevo) {
  if (anterior && nuevo && anterior !== nuevo) await storage.eliminarSeguro(anterior);
}

module.exports = { eliminarConArchivos, reemplazarArchivo };
