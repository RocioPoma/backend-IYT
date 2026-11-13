const express = require('express');
const connection = require('../connection');
const { errorBD } = require('../libs/errores');
const router = express.Router();


//------------------------ AGREGAR HECHO PARTIDO ---------------------------------------------------
router.post('/add_hecho', (req, res, next) => {
    let dato = req.body;
    const query = "insert into hechos_partido (id_partido,ci,id_club,id_contempla,id_hecho,id_time,descripcion_hecho) value(?,?,?,?,?,?,?)";
    connection.query(query, [dato.id_partido, dato.ci, dato.id_club, dato.id_contempla, dato.id_hecho, dato.id_time, dato.descripcion_hecho], (err, results) => {
        if (!err) {
            return res.status(200).json({ message: "Agregado con exito" });
        }
        else {
            return errorBD(res, err);
        }
    })
})

//-------------------------------- LISTAR HECHO PARTIDO (de un jugador, club, categoria especifica)-----------------------------------------------------
router.get('/getHechosPartido/:id_club/:id_contempla/:id_hecho/:id_partido', (req, res, next) => {
    const id_club = req.params.id_club;
    const id_contempla = req.params.id_contempla;
    const id_hecho= req.params.id_hecho;
    const id_partido= req.params.id_partido;

    connection.query(`SELECT hp.ci, hp.id_club, hp.id_contempla, hp.id_hecho, hp.id_partido,
               ANY_VALUE(hp.id_hechos_partido) AS id_hechos_partido, ANY_VALUE(hp.id_time) AS id_time,
               ANY_VALUE(hp.descripcion_hecho) AS descripcion_hecho,
               j.nombre, j.ap_paterno, j.ap_materno, ej.nro_camiseta, COUNT(*) AS hecho_jugador
        FROM hechos_partido hp
        JOIN equipo_jugador ej ON hp.ci = ej.ci AND hp.id_club = ej.id_club AND hp.id_contempla = ej.id_contempla
        JOIN jugador j ON j.ci = ej.ci
        WHERE hp.id_club = ? AND hp.id_contempla = ? AND hp.id_hecho = ? AND hp.id_partido = ?
        GROUP BY hp.ci, hp.id_club, hp.id_contempla, hp.id_hecho, hp.id_partido, j.nombre, j.ap_paterno, j.ap_materno, ej.nro_camiseta`, [id_club, id_contempla,id_hecho, id_partido], (err, results) => {
            if (!err) {
                return res.status(200).json(results);
            }
            else {
                return errorBD(res, err);
            }
        })
})

//-------------------------------- LISTAR TOTAL GOLES PARTIDO -----------------------------------------------------
router.get('/getTotalGolesPartido/:id_club/:id_contempla/:id_partido', (req, res, next) => {
    const id_club = req.params.id_club;
    const id_contempla = req.params.id_contempla;
    const id_partido= req.params.id_partido;

    connection.query("select count(id_hecho) as total from hechos_partido"
    + " where id_hecho=1 and id_club=? and id_contempla=? and  id_partido=? ;", [id_club, id_contempla,id_partido], (err, results) => {
            if (!err) {
                return res.status(200).json(results);
            }
            else {
                return errorBD(res, err);
            }
        })
})



//------------------------------------------------------------------------------------------------------



//-------------------------------- LISTAR JUGADORES DE UN EQUIPO ESPECIFICO en banca-----------------------------------------------------
router.get('/getJugadorEnBanca/:id_club/:id_contempla', (req, res, next) => {
    const id_club = req.params.id_club;
    const id_contempla = req.params.id_contempla;

    connection.query("select j.ci,j.nombre,j.ap_paterno,j.ap_materno, ej.id_club, ej.nro_camiseta, TIMESTAMPDIFF(YEAR,j.fecha_nacimiento,CURDATE()) AS edad"
        + " from jugador j, equipo_jugador ej, equipo e "
        + " where ej.estado='false' and ej.ci=j.ci and e.id_club=ej.id_club and e.id_contempla=ej.id_contempla and ej.id_club=? and e.id_contempla=? order by j.nombre;", [id_club, id_contempla], (err, results) => {
            if (!err) {
                return res.status(200).json(results);
            }
            else {
                return errorBD(res, err);
            }
        })
})

//------------------------ LISTAR JUGADORES --------------------------------------------------//todavia no se utilizo
router.get('/get', (req, res, next) => {
    var query = "select ej.*, j.nombre, j.ap_paterno, j.ap_materno, TIMESTAMPDIFF(YEAR,j.fecha_nacimiento,CURDATE()) AS edad"
        + " from equipo_jugador ej, jugador j"
        + " where ej.ci=j.ci order by j.nombre";
    connection.query(query, (err, results) => {
        if (!err) {
            return res.status(200).json(results);
        }
        else {
            return errorBD(res, err);
        }
    })
})

//------------------------ TIPOS DE HECHO (gol, aro, falta, tarjeta amarilla, tarjeta roja...) ----------------
router.get('/tipos', (req, res, next) => {
    connection.consulta('SELECT * FROM hechos_disciplinas ORDER BY id_hecho')
        .then((filas) => res.status(200).json(filas))
        .catch(next);
});

//------------------------ PLANILLA: TODOS LOS HECHOS DE UN PARTIDO (RF05.9.2.8.2.4.4) ----------------
router.get('/getByPartido/:id_partido', (req, res, next) => {
    connection.consulta(
        `SELECT hp.id_hechos_partido, hp.id_partido, hp.id_club, hp.id_hecho, hp.id_time, hp.descripcion_hecho,
                hd.nombre AS hecho, t.nombre AS tiempo, c.nombre AS club,
                j.nombre, j.ap_paterno, j.ap_materno, ej.nro_camiseta
         FROM hechos_partido hp
         LEFT JOIN hechos_disciplinas hd ON hd.id_hecho = hp.id_hecho
         LEFT JOIN all_times t ON t.id_time = hp.id_time
         LEFT JOIN club c ON c.id = hp.id_club
         LEFT JOIN jugador j ON j.ci = hp.ci
         LEFT JOIN equipo_jugador ej ON ej.ci = hp.ci AND ej.id_club = hp.id_club AND ej.id_contempla = hp.id_contempla
         WHERE hp.id_partido = ?
         ORDER BY hp.id_time, hp.id_hechos_partido`, [req.params.id_partido])
        .then((filas) => res.status(200).json(filas))
        .catch(next);
});

//------------------------ ANULAR UN HECHO REGISTRADO POR ERROR ----------------
router.delete('/delete/:id_hechos_partido', (req, res, next) => {
    connection.consulta('DELETE FROM hechos_partido WHERE id_hechos_partido=?', [req.params.id_hechos_partido])
        .then((r) => {
            if (r.affectedRows == 0) return res.status(404).json({ message: "Hecho no encontrado" });
            return res.status(200).json({ message: "Hecho eliminado con éxito" });
        })
        .catch(next);
});

module.exports = router;