// Fixture y partidos (RF05.9.2.8.2), tabla de posiciones (RF05.9.2.8.3) y ranking de jugadores (RF05.9.2.8.4).
const express = require('express');
const connection = require('../connection');


const router = express.Router();
const db = connection.consulta;
const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const ESTADOS = ['No realizado', 'En vivo', 'Cerrado'];

/**
 * Puntos según la disciplina (requisito 3.3.3: la tabla debe seguir al ente que la rige).
 * Fútbol / futsal / fútbol 8 (FIFA): 3 ganado, 1 empate, 0 perdido.
 * Baloncesto (FIBA): 2 ganado, 1 perdido (no hay empates).
 * Voleibol: 3 ganado, 0 perdido (simplificado, sin sets).
 */
function reglaPuntos(nombreDisciplina = '') {
  const n = nombreDisciplina.toLowerCase();
  if (/basquet|básquet|baloncesto|basket/.test(n)) return { ganado: 2, empate: 1, perdido: 1 };
  if (/voley|vóley|voleibol|volei/.test(n)) return { ganado: 3, empate: 1, perdido: 0 };
  return { ganado: 3, empate: 1, perdido: 0 };
}

async function disciplinaDeContempla(idContempla) {
  const f = await db(
    'SELECT d.nombre FROM contempla c JOIN disciplina d ON d.id = c.id_disciplina WHERE c.id = ?',
    [idContempla]
  );
  return f[0] ? f[0].nombre : '';
}

/**
 * Calendario todos-contra-todos por el método del círculo (Berger).
 * Cada equipo juega una vez contra cada rival; si el número es impar, en cada ronda un equipo descansa.
 */
function generarRoundRobin(equipos) {
  const lista = [...equipos];
  if (lista.length % 2 !== 0) lista.push(null); // null = descansa
  const n = lista.length;
  const rondas = [];
  for (let r = 0; r < n - 1; r++) {
    const partidos = [];
    for (let i = 0; i < n / 2; i++) {
      let local = lista[i];
      let visita = lista[n - 1 - i];
      // Alternar localía para equilibrar
      if (i === 0 && r % 2 === 1) [local, visita] = [visita, local];
      if (local !== null && visita !== null) partidos.push([local, visita]);
    }
    rondas.push(partidos);
    // Rotar todos menos el primero
    lista.splice(1, 0, lista.pop());
  }
  return rondas;
}

//------------ GENERAR FIXTURE (RF05.9.2.8.2.1) ------------
router.post('/add_fixture', h(async (req, res) => {
  const { id_contempla, id_serie } = req.body || {};
  if (!id_contempla) return res.status(400).json({ message: 'Falta la categoría (id_contempla)' });
  const serie = id_serie === undefined || id_serie === null || id_serie === '' ? 0 : id_serie;

  const equipos = await db(
    `SELECT e.id_club FROM equipo e
     WHERE e.id_contempla=? AND COALESCE(e.id_serie,0)=? AND COALESCE(e.estado,'aprobado')='aprobado'
     ORDER BY e.numero_sorteo, e.id_club`,
    [id_contempla, serie]
  );
  if (equipos.length < 2) {
    return res.status(400).json({ message: 'Se necesitan al menos 2 equipos aprobados para generar el fixture' });
  }
  const existentes = await db('SELECT COUNT(*) AS n FROM partido WHERE id_contempla=? AND COALESCE(id_serie,0)=?', [id_contempla, serie]);
  if (existentes[0].n > 0) {
    return res.status(400).json({ message: 'Ya existe un fixture para esta categoría/serie. Elimínelo antes de generar otro.' });
  }

  const rondas = generarRoundRobin(equipos.map((e) => e.id_club));
  await connection.transaccion(async (tx) => {
    for (let r = 0; r < rondas.length; r++) {
      for (const [local, visita] of rondas[r]) {
        await tx.query('INSERT INTO partido SET ?', [{
          id_equipo1: local,
          id_equipo2: visita,
          id_contempla,
          id_serie: serie,
          ronda: r + 1,
          estado: 'No realizado',
          total_equipo1: 0,
          total_equipo2: 0,
          puntos_equipo1: 0,
          puntos_equipo2: 0,
        }]);
      }
    }
  });
  const total = rondas.reduce((s, r) => s + r.length, 0);
  res.status(200).json({ message: `Fixture generado con exito: ${rondas.length} fechas, ${total} partidos` });
}));

const SELECT_PARTIDO = `
  SELECT p.*, c1.nombre AS equipo1, c2.nombre AS equipo2, c1.logo AS logo1, c2.logo AS logo2,
         DATE_FORMAT(p.fecha, '%d-%m-%Y') AS fecha_f, TIME_FORMAT(p.hora, '%H:%i') AS hora_f,
         ca.nombre AS nombre_cancha, ca.direccion AS direccion_cancha,
         CONCAT_WS(' ', a.nombre, a.ap_paterno, a.ap_materno) AS nombre_arbitro
  FROM partido p
  JOIN club c1 ON p.id_equipo1 = c1.id
  JOIN club c2 ON p.id_equipo2 = c2.id
  LEFT JOIN cancha ca ON p.id_cancha = ca.id_cancha
  LEFT JOIN arbitro a ON p.id_arbitro = a.ci`;

//------------ LISTAR PARTIDOS DE UNA CATEGORÍA (RF05.9.2.8.2.4) — público ------------
router.get('/get/:id_contempla/:id_serie', h(async (req, res) => {
  const filas = await db(
    `${SELECT_PARTIDO} WHERE p.id_contempla=? AND COALESCE(p.id_serie,0)=?
     ORDER BY COALESCE(p.ronda, 0), p.fecha IS NULL, p.fecha, p.hora, p.id_partido`,
    [req.params.id_contempla, req.params.id_serie || 0]
  );
  res.status(200).json(filas);
}));

//------------ DATOS DE UN PARTIDO — público ------------
router.get('/getPartido/:id_partido', h(async (req, res) => {
  const filas = await db(`${SELECT_PARTIDO} WHERE p.id_partido=?`, [req.params.id_partido]);
  res.status(200).json(filas);
}));

//------------ PRÓXIMOS PARTIDOS Y EN VIVO (vista pública) ------------
router.get('/proximos', h(async (req, res) => {
  const limite = Math.min(Number(req.query.limite) || 20, 100);
  const filas = await db(
    `${SELECT_PARTIDO}
     WHERE p.estado='En vivo' OR (p.estado='No realizado' AND p.fecha >= CURDATE())
     ORDER BY p.estado='En vivo' DESC, p.fecha, p.hora
     LIMIT ?`,
    [limite]
  );
  res.status(200).json(filas);
}));

//------------ ELIMINAR FIXTURE (RF05.9.2.8.2.2) ------------
// Borra los hechos registrados de esos partidos y luego los partidos.
router.delete('/delete/:id_contempla', h(async (req, res) => {
  const id = req.params.id_contempla;
  const serie = req.query.id_serie;
  const filtroSerie = serie !== undefined ? ' AND COALESCE(id_serie,0)=?' : '';
  const params = serie !== undefined ? [id, serie] : [id];
  const r = await connection.transaccion(async (tx) => {
    await tx.query(
      `DELETE FROM hechos_partido WHERE id_partido IN (SELECT id_partido FROM (SELECT id_partido FROM partido WHERE id_contempla=?${filtroSerie}) t)`,
      params
    );
    return tx.query(`DELETE FROM partido WHERE id_contempla=?${filtroSerie}`, params);
  });
  if (r.affectedRows == 0) return res.status(404).json({ message: 'Id no encontrado' });
  res.status(200).json({ message: 'Fixture eliminado con éxito' });
}));

//------------ PROGRAMAR PARTIDO: fecha, hora, campo de juego y árbitro (RF05.9.2.8.2.4.1-3) ------------
router.patch('/programar', h(async (req, res) => {
  const p = req.body || {};
  const r = await db(
    'UPDATE partido SET fecha=?, hora=?, id_cancha=?, id_arbitro=? WHERE id_partido=?',
    [p.fecha || null, p.hora || null, p.id_cancha || null, p.id_arbitro || null, p.id_partido]
  );
  if (r.affectedRows == 0) return res.status(404).json({ message: 'ID partido no encontrado' });
  res.status(200).json({ message: 'Partido programado con éxito' });
}));

//------------ CAMBIAR ESTADO (RF05.9.2.8.2.4.5.1): No realizado, En vivo, Cerrado ------------
router.patch('/updateStatus', h(async (req, res) => {
  const { estado, id_partido } = req.body || {};
  if (!ESTADOS.includes(estado)) return res.status(400).json({ message: `Estado inválido. Use: ${ESTADOS.join(', ')}` });
  const r = await db('UPDATE partido SET estado=? WHERE id_partido=?', [estado, id_partido]);
  if (r.affectedRows == 0) return res.status(404).json({ message: 'ID partido no encontrado' });
  res.status(200).json({ message: 'Estado Partido actualizado con éxito' });
}));

//------------ RESULTADO (RF05.9.2.8.2.4.5.2) ------------
router.patch('/updateResultadoPartido', h(async (req, res) => {
  const p = req.body || {};
  const t1 = Number(p.total_equipo1);
  const t2 = Number(p.total_equipo2);
  if (!Number.isInteger(t1) || !Number.isInteger(t2) || t1 < 0 || t2 < 0) {
    return res.status(400).json({ message: 'El resultado debe ser un número entero mayor o igual a 0' });
  }
  const partido = await db('SELECT id_contempla FROM partido WHERE id_partido=?', [p.id_partido]);
  if (!partido.length) return res.status(404).json({ message: 'ID partido no encontrado' });
  const regla = reglaPuntos(await disciplinaDeContempla(partido[0].id_contempla));
  let p1 = regla.empate;
  let p2 = regla.empate;
  if (t1 > t2) [p1, p2] = [regla.ganado, regla.perdido];
  else if (t1 < t2) [p1, p2] = [regla.perdido, regla.ganado];

  await db(
    'UPDATE partido SET total_equipo1=?, total_equipo2=?, puntos_equipo1=?, puntos_equipo2=? WHERE id_partido=?',
    [t1, t2, p1, p2, p.id_partido]
  );
  res.status(200).json({ message: 'Resultados Partido actualizado con éxito' });
}));

//------------ TABLA DE POSICIONES (RF05.9.2.8.3) — pública ------------
// PTS, PJ, PG, PE, PP, GF, GC, DG. Por defecto cuenta los partidos "Cerrado";
// con ?en_vivo=1 incluye también los que se están jugando (tabla en tiempo real).
router.get('/tabla/:id_contempla', h(async (req, res) => {
  const id = req.params.id_contempla;
  const serie = req.query.id_serie;
  const estados = req.query.en_vivo === '1' ? ['Cerrado', 'En vivo'] : ['Cerrado'];
  const filtroSerie = serie !== undefined && serie !== '' ? ' AND COALESCE(p.id_serie,0)=?' : '';
  const filtroSerieEq = serie !== undefined && serie !== '' ? ' AND COALESCE(e.id_serie,0)=?' : '';
  const params = [estados, id];
  if (filtroSerie) params.push(serie);

  const partidos = await db(
    `SELECT p.id_equipo1, p.id_equipo2, p.total_equipo1, p.total_equipo2, p.puntos_equipo1, p.puntos_equipo2
     FROM partido p WHERE p.estado IN (?) AND p.id_contempla=?${filtroSerie}`,
    params
  );
  const equipos = await db(
    `SELECT e.id_club, c.nombre, c.logo, COALESCE(e.id_serie,0) AS id_serie
     FROM equipo e JOIN club c ON c.id = e.id_club
     WHERE e.id_contempla=? AND COALESCE(e.estado,'aprobado')='aprobado'${filtroSerieEq}`,
    filtroSerieEq ? [id, serie] : [id]
  );

  const tabla = new Map(
    equipos.map((e) => [e.id_club, { id_club: e.id_club, equipo: e.nombre, logo: e.logo, id_serie: e.id_serie,
      pts: 0, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dg: 0 }])
  );
  for (const p of partidos) {
    const lados = [
      [p.id_equipo1, p.total_equipo1, p.total_equipo2, p.puntos_equipo1],
      [p.id_equipo2, p.total_equipo2, p.total_equipo1, p.puntos_equipo2],
    ];
    for (const [club, favor, contra, pts] of lados) {
      const t = tabla.get(club);
      if (!t) continue;
      t.pj++;
      t.gf += favor || 0;
      t.gc += contra || 0;
      t.pts += pts || 0;
      if (favor > contra) t.pg++;
      else if (favor < contra) t.pp++;
      else t.pe++;
    }
  }
  const lista = [...tabla.values()].map((t) => ({
    ...t,
    dg: t.gf - t.gc,
    rendimiento: t.pj ? Math.round((t.pts / (t.pj * 3)) * 100) : 0,
  }));
  // Orden: puntos, diferencia de goles, goles a favor, nombre
  lista.sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf || a.equipo.localeCompare(b.equipo));
  lista.forEach((t, i) => (t.posicion = i + 1));
  res.status(200).json(lista);
}));

//------------ RANKING DE JUGADORES (RF05.9.2.8.4) — público ------------
// Por defecto el hecho 1 (gol/aro según la disciplina). ?id_hecho=N para otro tipo de hecho.
router.get('/ranking/:id_contempla', h(async (req, res) => {
  const idHecho = Number(req.query.id_hecho || 1);
  const limite = Math.min(Number(req.query.limite) || 20, 100);
  const filas = await db(
    `SELECT hp.ci, j.nombre, j.ap_paterno, j.ap_materno, j.foto, c.nombre AS club, hd.nombre AS hecho,
            COUNT(*) AS total
     FROM hechos_partido hp
     JOIN jugador j ON j.ci = hp.ci
     JOIN club c ON c.id = hp.id_club
     LEFT JOIN hechos_disciplinas hd ON hd.id_hecho = hp.id_hecho
     WHERE hp.id_contempla = ? AND hp.id_hecho = ?
     GROUP BY hp.ci, j.nombre, j.ap_paterno, j.ap_materno, j.foto, c.nombre, hd.nombre
     ORDER BY total DESC, j.ap_paterno, j.nombre
     LIMIT ?`,
    [req.params.id_contempla, idHecho, limite]
  );
  // No exponemos el CI en la vista pública
  const publico = !req.usuario;
  res.status(200).json(filas.map((f, i) => ({ posicion: i + 1, ...f, ci: publico ? undefined : f.ci })));
}));

module.exports = router;
module.exports.generarRoundRobin = generarRoundRobin;
module.exports.reglaPuntos = reglaPuntos;
