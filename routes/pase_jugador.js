// Pase de jugador (RF08). Un pase solo se registra con la hoja de pase firmada (documento PDF/imagen).
const express = require('express');
const connection = require('../connection');
const multer = require('../libs/multer');
const { eliminarConArchivos, reemplazarArchivo } = require('../libs/archivos');
const storage = require('../services/storage');

const router = express.Router();
const db = connection.consulta;
const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

//------------ LISTAR PASES (RF08.5) ------------
router.get('/get', h(async (req, res) => {
  const filas = await db(`
    SELECT pj.*, c1.nombre AS club_solicitante, c2.nombre AS club_solicitado,
           j.nombre, j.ap_paterno, j.ap_materno, DATE_FORMAT(pj.fecha, '%d-%m-%Y') AS fecha2
    FROM pase_jugador pj
    JOIN club c1 ON pj.id_club_solicitante = c1.id
    JOIN club c2 ON pj.id_club_solicitado = c2.id
    JOIN jugador j ON pj.ci = j.ci
    ORDER BY pj.fecha DESC, pj.id_pase DESC`);
  res.status(200).json(filas);
}));

//------------ REGISTRAR PASE (RF08.1) ------------
router.post('/add', multer.single('documento'), h(async (req, res) => {
  const p = req.body || {};
  if (!req.file) {
    return res.status(400).json({ message: 'Debe adjuntar la hoja de pase firmada (RF08)' });
  }
  if (!p.ci || !p.id_club_solicitante || !p.id_club_solicitado) {
    await storage.eliminarSeguro(req.file.filename);
    return res.status(400).json({ message: 'Faltan datos del pase (jugador y clubs)' });
  }
  if (String(p.id_club_solicitante) === String(p.id_club_solicitado)) {
    await storage.eliminarSeguro(req.file.filename);
    return res.status(400).json({ message: 'El club solicitante y el club de origen no pueden ser el mismo' });
  }

  try {
    await connection.transaccion(async (tx) => {
      const jug = await tx.query('SELECT clubId FROM jugador WHERE ci=? FOR UPDATE', [p.ci]);
      if (!jug.length) {
        const e = new Error('Jugador CI no encontrado');
        e.status = 404;
        throw e;
      }
      await tx.query('INSERT INTO pase_jugador SET ?', [{
        id_club_solicitante: p.id_club_solicitante,
        id_club_solicitado: p.id_club_solicitado,
        ci: p.ci,
        fecha: p.fecha ? new Date(p.fecha) : new Date(),
        documento: req.file.filename,
        estado: 'true',
      }]);
      await tx.query('UPDATE jugador SET clubId=? WHERE ci=?', [p.id_club_solicitante, p.ci]);
    });
  } catch (e) {
    await storage.eliminarSeguro(req.file.filename);
    throw e;
  }
  res.status(200).json({ message: 'Pase Jugador agregado y Club ID actualizado con éxito' });
}));

//------------ MODIFICAR PASE (RF08.2) ------------
router.patch('/update', multer.single('documento'), h(async (req, res) => {
  const p = req.body || {};
  const actual = await db('SELECT documento FROM pase_jugador WHERE id_pase=?', [p.id_pase]);
  if (!actual.length) {
    if (req.file) await storage.eliminarSeguro(req.file.filename);
    return res.status(404).json({ message: 'Id Pase no encontrado' });
  }
  const documento = req.file ? req.file.filename : actual[0].documento;
  await db(
    `UPDATE pase_jugador SET id_club_solicitante=?, id_club_solicitado=?, ci=?, fecha=?, documento=? WHERE id_pase=?`,
    [p.id_club_solicitante, p.id_club_solicitado, p.ci, p.fecha ? new Date(p.fecha) : new Date(), documento, p.id_pase]
  );
  if (req.file) await reemplazarArchivo(actual[0].documento, documento);
  res.status(200).json({ message: 'Pase jugador Actualizado con exito' });
}));

//------------ ELIMINAR PASE (RF08.3) ------------
router.delete('/delete/:id_pase', h(async (req, res) => {
  const r = await eliminarConArchivos('pase_jugador', 'id_pase', req.params.id_pase, ['documento']);
  if (r.affectedRows == 0) return res.status(404).json({ message: 'Id Pase no encontrado' });
  res.status(200).json({ message: 'Pase jugador eliminado con éxito' });
}));

module.exports = router;
