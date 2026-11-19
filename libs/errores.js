// Respuesta de error para las rutas con callbacks: registra el detalle en el servidor
// y envía al navegador un mensaje claro, sin datos internos de la base de datos.
const MENSAJES = {
  ER_DUP_ENTRY: 'Ya existe un registro con esos datos',
  ER_ROW_IS_REFERENCED_2: 'No se puede eliminar porque tiene registros relacionados',
  ER_ROW_IS_REFERENCED: 'No se puede eliminar porque tiene registros relacionados',
  ER_NO_REFERENCED_ROW_2: 'Uno de los datos seleccionados no existe',
  ER_BAD_NULL_ERROR: 'Faltan datos obligatorios',
  ER_DATA_TOO_LONG: 'Uno de los datos es demasiado largo',
  ER_TRUNCATED_WRONG_VALUE: 'Uno de los datos tiene un formato inválido',
};

function errorBD(res, err) {
  if (err && MENSAJES[err.code]) return res.status(400).json({ message: MENSAJES[err.code] });
  console.error('[db]', err && (err.sqlMessage || err.message || err));
  return res.status(500).json({ message: 'Algo salió mal. Por favor, inténtelo de nuevo más tarde' });
}

module.exports = { errorBD };
