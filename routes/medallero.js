// Medallero (RF05.9.2.8.5): los 3 primeros lugares de cada categoría de un campeonato.
const express = require('express');
const connection = require('../connection');

const router = express.Router();
const db = connection.consulta;
const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const SELECT = `
  SELECT m.id, m.id_contempla, m.puesto, m.id_club, c.nombre AS club, c.logo,
         d.nombre AS disciplina, cat.nombre AS categoria, con.genero, con.id_campeonato
  FROM medallero m
  JOIN club c ON c.id = m.id_club
  JOIN contempla con ON con.id = m.id_contempla
  JOIN disciplina d ON d.id = con.id_disciplina
  JOIN categoria cat ON cat.id = con.id_categoria`;

//------------ MEDALLERO DE UNA CATEGORÍA — público ------------
router.get('/categoria/:id_contempla', h(async (req, res) => {
  res.status(200).json(await db(`${SELECT} WHERE m.id_contempla=? ORDER BY m.puesto`, [req.params.id_contempla]));
}));

//------------ MEDALLERO DE UN CAMPEONATO — público ------------
// Devuelve el detalle por categoría y el resumen de medallas por club (oro, plata, bronce).
router.get('/campeonato/:id_campeonato', h(async (req, res) => {
  const detalle = await db(`${SELECT} WHERE con.id_campeonato=? ORDER BY d.nombre, cat.nombre, m.puesto`, [req.params.id_campeonato]);
  const porClub = new Map();
  for (const f of detalle) {
    const c = porClub.get(f.id_club) || { id_club: f.id_club, club: f.club, logo: f.logo, oro: 0, plata: 0, bronce: 0, total: 0 };
    if (f.puesto === 1) c.oro++;
    if (f.puesto === 2) c.plata++;
    if (f.puesto === 3) c.bronce++;
    c.total++;
    porClub.set(f.id_club, c);
  }
  const resumen = [...porClub.values()].sort(
    (a, b) => b.oro - a.oro || b.plata - a.plata || b.bronce - a.bronce || a.club.localeCompare(b.club)
  );
  res.status(200).json({ resumen, detalle });
}));

//------------ REGISTRAR MEDALLERO DE UNA CATEGORÍA (RF05.9.2.8.5.1) ------------
// Cuerpo: { id_contempla, primero: id_club, segundo: id_club, tercero: id_club }
router.post('/registrar', h(async (req, res) => {
  const { id_contempla, primero, segundo, tercero } = req.body || {};
  const puestos = [[1, primero], [2, segundo], [3, tercero]].filter(([, c]) => c);
  if (!id_contempla || !primero) return res.status(400).json({ message: 'Indique la categoría y al menos el primer lugar' });
  const clubs = puestos.map(([, c]) => String(c));
  if (new Set(clubs).size !== clubs.length) return res.status(400).json({ message: 'Un club no puede ocupar dos puestos' });

  await connection.transaccion(async (tx) => {
    await tx.query('DELETE FROM medallero WHERE id_contempla=?', [id_contempla]);
    for (const [puesto, club] of puestos) {
      await tx.query('INSERT INTO medallero (id_contempla, puesto, id_club) VALUES (?, ?, ?)', [id_contempla, puesto, club]);
    }
  });
  res.status(200).json({ message: 'Medallero registrado con éxito' });
}));

//------------ ELIMINAR MEDALLERO DE UNA CATEGORÍA (RF05.9.2.8.5.2) ------------
router.delete('/delete/:id_contempla', h(async (req, res) => {
  const r = await db('DELETE FROM medallero WHERE id_contempla=?', [req.params.id_contempla]);
  if (r.affectedRows == 0) return res.status(404).json({ message: 'No hay medallero registrado para esta categoría' });
  res.status(200).json({ message: 'Medallero eliminado con éxito' });
}));

module.exports = router;
