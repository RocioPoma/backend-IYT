// Campos de juego (RF10): canchas de fútbol, básquet, fútbol de salón, etc.
const express = require('express');
const connection = require('../connection');

const router = express.Router();
const db = connection.consulta;
const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function validar(c) {
  if (!c.nombre || String(c.nombre).trim().length < 2) return 'El nombre del campo de juego es obligatorio';
  return null;
}

//------------ LISTAR (RF10.4) — público ------------
router.get('/get', h(async (req, res) => {
  const soloActivos = !req.usuario || req.query.activos === '1';
  res.status(200).json(await db(
    `SELECT * FROM cancha ${soloActivos ? "WHERE COALESCE(estado,'true')='true'" : ''} ORDER BY nombre`
  ));
}));

router.get('/getById/:id', h(async (req, res) => {
  const f = await db('SELECT * FROM cancha WHERE id_cancha=?', [req.params.id]);
  if (!f.length) return res.status(404).json({ message: 'Campo de juego no encontrado' });
  res.status(200).json(f[0]);
}));

//------------ AGREGAR (RF10.1) ------------
router.post('/add', h(async (req, res) => {
  const c = req.body || {};
  const error = validar(c);
  if (error) return res.status(400).json({ message: error });
  await db('INSERT INTO cancha (nombre, direccion, tipo, estado) VALUES (?, ?, ?, ?)', [
    String(c.nombre).trim(), c.direccion || null, c.tipo || null, 'true',
  ]);
  res.status(200).json({ message: 'Campo de juego agregado con éxito' });
}));

//------------ MODIFICAR (RF10.2) ------------
router.patch('/update', h(async (req, res) => {
  const c = req.body || {};
  const error = validar(c);
  if (error) return res.status(400).json({ message: error });
  const r = await db('UPDATE cancha SET nombre=?, direccion=?, tipo=? WHERE id_cancha=?', [
    String(c.nombre).trim(), c.direccion || null, c.tipo || null, c.id_cancha,
  ]);
  if (r.affectedRows == 0) return res.status(404).json({ message: 'Campo de juego no encontrado' });
  res.status(200).json({ message: 'Campo de juego actualizado con éxito' });
}));

router.patch('/updateStatus', h(async (req, res) => {
  const { id_cancha, estado } = req.body || {};
  const r = await db('UPDATE cancha SET estado=? WHERE id_cancha=?', [String(estado) === 'true' ? 'true' : 'false', id_cancha]);
  if (r.affectedRows == 0) return res.status(404).json({ message: 'Campo de juego no encontrado' });
  res.status(200).json({ message: 'Estado actualizado con éxito' });
}));

//------------ ELIMINAR (RF10.3) ------------
router.delete('/delete/:id', h(async (req, res) => {
  const usados = await db('SELECT COUNT(*) AS n FROM partido WHERE id_cancha=?', [req.params.id]);
  if (usados[0].n > 0) {
    return res.status(400).json({ message: 'El campo de juego tiene partidos asignados. Puede desactivarlo en lugar de eliminarlo.' });
  }
  const r = await db('DELETE FROM cancha WHERE id_cancha=?', [req.params.id]);
  if (r.affectedRows == 0) return res.status(404).json({ message: 'Campo de juego no encontrado' });
  res.status(200).json({ message: 'Campo de juego eliminado con éxito' });
}));

module.exports = router;
