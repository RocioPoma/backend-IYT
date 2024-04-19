const express = require('express');
const connection = require('../connection');
const router = express.Router();
var auth = require('../services/authentication');
var checkRole = require('../services/checkRole');


//------------------------ AGREGAR JUGADORES A UN EQUIPO ---------------------------------------------------
router.post('/add', auth.authenticateToken, checkRole.checkRole, (req, res, next) => {
    let dato = req.body;
    query = "insert into equipo_jugador (id_club,id_contempla,ci,estado) value(?,?,?,'false')";
    connection.query(query, [dato.id_club, dato.id_contempla, dato.ci], (err, results) => {
        if (!err) {
            return res.status(200).json({ message: "Agregado con exito" });
        }
        else {
            return res.status(500).json(err);
        }
    })
})

//-------------------------------- LISTAR JUGADORES DE UN EQUIPO ESPECIFICO-----------------------------------------------------
router.get('/get/:id_club/:id_contempla', auth.authenticateToken, (req, res, next) => {
    const id_club = req.params.id_club;
    const id_contempla = req.params.id_contempla;
    
    connection.query("select j.ci,j.nombre,j.ap_paterno,j.ap_materno, ej.id_club, ej.estado, TIMESTAMPDIFF(YEAR,j.fecha_nacimiento,CURDATE()) AS edad,"
        + " case when ej.id_club!=? then false else true end as checked"
        + " from jugador j, equipo_jugador ej, equipo e where ej.id_club=? and ej.ci=j.ci and e.id_club=ej.id_club and e.id_contempla=ej.id_contempla and e.id_contempla=? order by j.nombre", [id_club, id_club, id_contempla], (err, results) => {
            if (!err) {
                return res.status(200).json(results);
            }
            else {
                return res.status(500).json(err);
            }
        })
})

//-------------------------------- LISTAR JUGADORES DE UN EQUIPO ESPECIFICO habilitados en cancha-----------------------------------------------------
router.get('/getJugadorEnCancha/:id_club/:id_contempla', auth.authenticateToken, (req, res, next) => {
    const id_club = req.params.id_club;
    const id_contempla = req.params.id_contempla;
    
    connection.query("select j.ci,j.nombre,j.ap_paterno,j.ap_materno, ej.id_club, ej.nro_camiseta,ej.estado, TIMESTAMPDIFF(YEAR,j.fecha_nacimiento,CURDATE()) AS edad"
        + " from jugador j, equipo_jugador ej, equipo e "
        + " where ej.estado='true' and ej.ci=j.ci and e.id_club=ej.id_club and e.id_contempla=ej.id_contempla and ej.id_club=? and e.id_contempla=? order by j.nombre;", [ id_club, id_contempla], (err, results) => {
            if (!err) {
                return res.status(200).json(results);
            }
            else {
                return res.status(500).json(err);
            }
        })
})

//-------------------------------- LISTAR JUGADORES DE UN EQUIPO ESPECIFICO en banca-----------------------------------------------------
router.get('/getJugadorEnBanca/:id_club/:id_contempla', auth.authenticateToken, (req, res, next) => {
    const id_club = req.params.id_club;
    const id_contempla = req.params.id_contempla;
    
    connection.query("select j.ci,j.nombre,j.ap_paterno,j.ap_materno, ej.id_club, ej.nro_camiseta,ej.estado, TIMESTAMPDIFF(YEAR,j.fecha_nacimiento,CURDATE()) AS edad"
    + " from jugador j, equipo_jugador ej, equipo e "
    + " where ej.estado='false' and ej.ci=j.ci and e.id_club=ej.id_club and e.id_contempla=ej.id_contempla and ej.id_club=? and e.id_contempla=? order by j.nombre;", [ id_club, id_contempla], (err, results) => {
            if (!err) {
                return res.status(200).json(results);
            }
            else {
                return res.status(500).json(err);
            }
        })
})

//-------------------------------- CONTAR JUGADORES DE UN EQUIPO ESPECIFICO habilitados en cancha-----------------------------------------------------
router.get('/getTotalEnCancha/:id_club/:id_contempla', auth.authenticateToken, (req, res, next) => {
    const id_club = req.params.id_club;
    const id_contempla = req.params.id_contempla;
    
    connection.query("select count(j.ci) as en_cancha"
        + " from jugador j, equipo_jugador ej, equipo e "
        + " where ej.estado='true' and ej.ci=j.ci and e.id_club=ej.id_club and e.id_contempla=ej.id_contempla and ej.id_club=? and e.id_contempla=? order by j.nombre;", [ id_club, id_contempla], (err, results) => {
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

//------------------------ MODIFICAR ESTADO JUGADOR---------------------------------------------------
router.patch('/updateEstado', auth.authenticateToken, checkRole.checkRole, (req, res, next) => {
    let eqj = req.body; //eqj = equipo_jugador
    var query = "update equipo_jugador set estado=? where id_club=? and id_contempla=? and ci=?";
    connection.query(query, [eqj.estado,eqj.id_club,eqj.id_contempla,eqj.ci], (err, results) => {
        if (!err) {
            if (results.affectedRows == 0) {
                return res.status(404).json({ message: "Ids no encontrado" });
            }
            return res.status(200).json({ message: "Equipo actualizado con exito" });
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