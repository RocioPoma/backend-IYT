// Clubs (RF03). El logo se guarda en el servidor de archivos.
const express = require('express');
const connection = require('../connection');
const multer = require('../libs/multer');
const { eliminarConArchivos, reemplazarArchivo } = require('../libs/archivos');

const router = express.Router();
const db = connection.consulta;
const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function validar(c) {
  if (!c.nombre || String(c.nombre).trim().length < 2) return 'El nombre del club es obligatorio';
  if (!c.comunidad || String(c.comunidad).trim().length < 2) return 'La comunidad es obligatoria';
  return null;
}

//------------ REGISTRAR CLUB (RF03.2) ------------
router.post('/add', multer.single('logo'), h(async (req, res) => {
  const c = req.body || {};
  const error = validar(c);
  if (error) return res.status(400).json({ message: error });
  const existe = await db('SELECT id FROM club WHERE nombre=? AND comunidad=?', [c.nombre.trim(), c.comunidad.trim()]);
  if (existe.length) return res.status(400).json({ message: 'Ya existe un club con ese nombre en esa comunidad' });
  await db('INSERT INTO club (nombre, comunidad, logo) VALUES (?, ?, ?)', [
    c.nombre.trim(), c.comunidad.trim(), req.file ? req.file.filename : null,
  ]);
  res.status(200).json({ message: 'Club agregado con exito' });
}));

//------------ LISTAR CLUBS (RF03.1) — público ------------
router.get('/get', h(async (req, res) => {
  res.status(200).json(await db('SELECT * FROM club ORDER BY nombre'));
}));

router.get('/get/:id_club', h(async (req, res) => {
  res.status(200).json(await db('SELECT * FROM club WHERE id=?', [req.params.id_club]));
}));

//------------ MODIFICAR CLUB (RF03.3) ------------
router.patch('/update', multer.single('logo'), h(async (req, res) => {
  const c = req.body || {};
  const error = validar(c);
  if (error) return res.status(400).json({ message: error });
  const actual = await db('SELECT logo FROM club WHERE id=?', [c.id]);
  if (!actual.length) return res.status(404).json({ message: 'Club Id no encontrado' });
  const logo = req.file ? req.file.filename : actual[0].logo;
  await db('UPDATE club SET nombre=?, comunidad=?, logo=? WHERE id=?', [c.nombre.trim(), c.comunidad.trim(), logo, c.id]);
  if (req.file) await reemplazarArchivo(actual[0].logo, logo);
  res.status(200).json({ message: 'Club actualizado con exito' });
}));

//------------ ELIMINAR CLUB (RF03.4) ------------
router.delete('/delete/:id', h(async (req, res) => {
  const r = await eliminarConArchivos('club', 'id', req.params.id, ['logo']);
  if (r.affectedRows == 0) return res.status(404).json({ message: 'Id Club no encontrado' });
  res.status(200).json({ message: 'Club eliminado con éxito' });
}));

module.exports = router;
