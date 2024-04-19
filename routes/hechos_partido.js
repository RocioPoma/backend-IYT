const express = require('express');
const connection = require('../connection');
const router = express.Router();
var auth = require('../services/authentication');
var checkRole = require('../services/checkRole');


//------------------------ AGREGAR HECHO PARTIDO ---------------------------------------------------
router.post('/add_hecho', auth.authenticateToken, checkRole.checkRole, (req, res, next) => {
    let dato = req.body;
    query = "insert into hechos_partido (id_partido,ci,id_club,id_contempla,id_hecho,id_time,descripcion_hecho) value(?,?,?,?,?,?,?)";
    connection.query(query, [dato.id_partido, dato.ci, dato.id_club, dato.id_contempla, dato.id_hecho, dato.id_time, dato.descripcion_hecho], (err, results) => {
        if (!err) {
            return res.status(200).json({ message: "Agregado con exito" });
        }
        else {
            return res.status(500).json(err);
        }
    })
})

//-------------------------------- LISTAR HECHO PARTIDO (de un jugador, club, categoria especifica)-----------------------------------------------------
router.get('/getHechosPartido/:id_club/:id_contempla/:id_hecho/:id_partido', auth.authenticateToken, (req, res, next) => {
    const id_club = req.params.id_club;
    const id_contempla = req.params.id_contempla;
    const id_hecho= req.params.id_hecho;
    const id_partido= req.params.id_partido;

    connection.query("select hp.*, j.nombre,j.ap_paterno,j.ap_materno, ej.nro_camiseta, count(hp.ci) as hecho_jugador"
        + " from hechos_partido hp, jugador j, hechos_disciplinas hd, equipo_jugador ej, partido p"
        + " where hp.ci=ej.ci and hp.id_club=ej.id_club and hp.id_contempla=ej.id_contempla and hp.id_hecho=hd.id_hecho"
        + " and hp.id_partido=p.id_partido and j.ci=ej.ci and hp.id_club=? and hp.id_contempla=?  and hp.id_hecho=? and hp.id_partido=?"
        + " GROUP BY hp.ci ;", [id_club, id_contempla,id_hecho, id_partido], (err, results) => {
            if (!err) {
                return res.status(200).json(results);
            }
            else {
                return res.status(500).json(err);
            }
        })
})

//-------------------------------- LISTAR TOTAL GOLES PARTIDO -----------------------------------------------------
router.get('/getTotalGolesPartido/:id_club/:id_contempla/:id_partido', auth.authenticateToken, (req, res, next) => {
    const id_club = req.params.id_club;
    const id_contempla = req.params.id_contempla;
    const id_partido= req.params.id_partido;

    connection.query("select count(id_hecho) as total from hechos_partido"
    + " where id_hecho=1 and id_club=? and id_contempla=? and  id_partido=? ;", [id_club, id_contempla,id_partido], (err, results) => {
            if (!err) {
                return res.status(200).json(results);
            }
            else {
                return res.status(500).json(err);
            }
        })
})



//------------------------------------------------------------------------------------------------------



//-------------------------------- LISTAR JUGADORES DE UN EQUIPO ESPECIFICO en banca-----------------------------------------------------
router.get('/getJugadorEnBanca/:id_club/:id_contempla', auth.authenticateToken, (req, res, next) => {
    const id_club = req.params.id_club;
    const id_contempla = req.params.id_contempla;

    connection.query("select j.ci,j.nombre,j.ap_paterno,j.ap_materno, ej.id_club, ej.nro_camiseta, TIMESTAMPDIFF(YEAR,j.fecha_nacimiento,CURDATE()) AS edad"
        + " from jugador j, equipo_jugador ej, equipo e "
        + " where ej.estado='false' and ej.ci=j.ci and e.id_club=ej.id_club and e.id_contempla=ej.id_contempla and ej.id_club=? and e.id_contempla=? order by j.nombre;", [id_club, id_contempla], (err, results) => {
            if (!err) {
                return res.status(200).json(results);
            }
            else {
                return res.status(500).json(err);
            }
        })
})

//------------------------ LISTAR JUGADORES --------------------------------------------------//todavia no se utilizo
router.get('/get', auth.authenticateToken, (req, res, next) => {
    var query = "select ej.*, j.nombre, j.ap_paterno, j.ap_materno, TIMESTAMPDIFF(YEAR,j.fecha_nacimiento,CURDATE()) AS edad"
        + " from equipo_jugador ej, jugador j"
        + " where ej.ci=j.ci order by j.nombre";
    connection.query(query, (err, results) => {
        if (!err) {
            return res.status(200).json(results);
        }
        else {
            return res.status(500).json(err);
        }
    })
})

//------------------------ MODIFICAR CLUBS---------------------------------------------------
router.patch('/update', auth.authenticateToken, checkRole.checkRole, (req, res, next) => {
    let club = req.body;
    var query = "update club set nombre=?,comunidad=? where id=?";
    connection.query(query, [club.nombre, club.comunidad, club.id], (err, results) => {
        if (!err) {
            if (results.affectedRows == 0) {
                return res.status(404).json({ message: "Club Id no encontrado" });
            }
            return res.status(200).json({ message: "Club actualizado con exito" });
        }
        else {
            return res.status(500).json(err);
        }
    })
})

//------------------------ ELIMINAR JUGADOR-EQUIPO --------------------------------------------------------

router.delete('/delete/:id_club/:id_contempla/:ci', auth.authenticateToken, (req, res, next) => {
    const id_club = req.params.id_club;
    const id_contempla = req.params.id_contempla;
    const ci = req.params.ci;
    var query = "delete from equipo_jugador where id_club=? and id_contempla=? and ci=?";
    connection.query(query, [id_club, id_contempla, ci], (err, results) => {
        if (!err) {
            if (results.affectedRows == 0) {
                return res.status(404).json({ message: "Datos no encontrado" });
            }
            return res.status(200).json({ message: "EquipoJugador eliminado con éxito" });
        }
        else {
            return res.status(500).json(err);
        }
    })
})

module.exports = router;