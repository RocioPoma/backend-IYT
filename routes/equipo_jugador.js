const express = require('express');
const connection = require('../connection');
const { errorBD } = require('../libs/errores');
const router = express.Router();
const { soloSuClub } = require('../services/club');


//------------------------ AGREGAR JUGADORES A UN EQUIPO ---------------------------------------------------
router.post('/add', soloSuClub((req) => req.body && req.body.id_club), async (req, res, next) => {
    try {
        const dato = req.body || {};
        const db = connection.consulta;
        const jug = await db("SELECT clubId, status FROM jugador WHERE ci=?", [dato.ci]);
        if (!jug.length) return res.status(404).json({ message: "Jugador no encontrado" });
        if (String(jug[0].clubId) !== String(dato.id_club)) {
            return res.status(400).json({ message: "El jugador no pertenece a este club" });
        }
        if (jug[0].status === 'false') return res.status(400).json({ message: "El jugador está deshabilitado" });
        // RF05.9.2.8.1.6: un jugador solo puede pertenecer a un equipo por categoría
        const otro = await db("SELECT id_club FROM equipo_jugador WHERE ci=? AND id_contempla=? AND id_club<>?", [dato.ci, dato.id_contempla, dato.id_club]);
        if (otro.length) return res.status(400).json({ message: "El jugador ya está inscrito en otro equipo de esta categoría" });
        const cat = await db("SELECT num_max_jugadores FROM contempla WHERE id=?", [dato.id_contempla]);
        const max = cat.length ? Number(cat[0].num_max_jugadores) : 0;
        if (max > 0) {
            const n = await db("SELECT COUNT(*) AS n FROM equipo_jugador WHERE id_club=? AND id_contempla=?", [dato.id_club, dato.id_contempla]);
            if (n[0].n >= max) return res.status(400).json({ message: `El equipo ya tiene el máximo de ${max} jugadores` });
        }
        await db("INSERT INTO equipo_jugador (id_club,id_contempla,ci,estado,nro_camiseta) VALUES (?,?,?,'false',?)",
            [dato.id_club, dato.id_contempla, dato.ci, dato.nro_camiseta || null]);
        return res.status(200).json({ message: "Agregado con exito" });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: "El jugador ya está en el equipo" });
        next(err);
    }
})

//-------------------------------- LISTAR JUGADORES DE UN EQUIPO ESPECIFICO-----------------------------------------------------
router.get('/get/:id_club/:id_contempla', (req, res, next) => {
    const id_club = req.params.id_club;
    const id_contempla = req.params.id_contempla;
    
    connection.query("select j.ci,j.nombre,j.ap_paterno,j.ap_materno, ej.id_club, ej.estado,DATE_FORMAT(j.fecha_nacimiento, '%d-%m-%Y') as fecha_nac, TIMESTAMPDIFF(YEAR,j.fecha_nacimiento,CURDATE()) AS edad,"
        + " case when ej.id_club!=? then false else true end as checked"
        + " from jugador j, equipo_jugador ej, equipo e where ej.id_club=? and ej.ci=j.ci and e.id_club=ej.id_club and e.id_contempla=ej.id_contempla and e.id_contempla=? order by j.nombre", [id_club, id_club, id_contempla], (err, results) => {
            if (!err) {
                return res.status(200).json(results);
            }
            else {
                return errorBD(res, err);
            }
        })
})

//-------------------------------- LISTAR JUGADORES DE UN EQUIPO ESPECIFICO habilitados en cancha-----------------------------------------------------
router.get('/getJugadorEnCancha/:id_club/:id_contempla', (req, res, next) => {
    const id_club = req.params.id_club;
    const id_contempla = req.params.id_contempla;
    
    connection.query("select j.ci,j.nombre,j.ap_paterno,j.ap_materno, ej.id_club, ej.nro_camiseta,ej.estado, TIMESTAMPDIFF(YEAR,j.fecha_nacimiento,CURDATE()) AS edad"
        + " from jugador j, equipo_jugador ej, equipo e "
        + " where ej.estado='true' and ej.ci=j.ci and e.id_club=ej.id_club and e.id_contempla=ej.id_contempla and ej.id_club=? and e.id_contempla=? order by j.nombre;", [ id_club, id_contempla], (err, results) => {
            if (!err) {
                return res.status(200).json(results);
            }
            else {
                return errorBD(res, err);
            }
        })
})

//-------------------------------- LISTAR JUGADORES DE UN EQUIPO ESPECIFICO en banca-----------------------------------------------------
router.get('/getJugadorEnBanca/:id_club/:id_contempla', (req, res, next) => {
    const id_club = req.params.id_club;
    const id_contempla = req.params.id_contempla;
    
    connection.query("select j.ci,j.nombre,j.ap_paterno,j.ap_materno, ej.id_club, ej.nro_camiseta,ej.estado, TIMESTAMPDIFF(YEAR,j.fecha_nacimiento,CURDATE()) AS edad"
    + " from jugador j, equipo_jugador ej, equipo e "
    + " where ej.estado='false' and ej.ci=j.ci and e.id_club=ej.id_club and e.id_contempla=ej.id_contempla and ej.id_club=? and e.id_contempla=? order by j.nombre;", [ id_club, id_contempla], (err, results) => {
            if (!err) {
                return res.status(200).json(results);
            }
            else {
                return errorBD(res, err);
            }
        })
})

//-------------------------------- CONTAR JUGADORES DE UN EQUIPO ESPECIFICO habilitados en cancha-----------------------------------------------------
router.get('/getTotalEnCancha/:id_club/:id_contempla', (req, res, next) => {
    const id_club = req.params.id_club;
    const id_contempla = req.params.id_contempla;
    
    connection.query("select count(j.ci) as en_cancha"
        + " from jugador j, equipo_jugador ej, equipo e "
        + " where ej.estado='true' and ej.ci=j.ci and e.id_club=ej.id_club and e.id_contempla=ej.id_contempla and ej.id_club=? and e.id_contempla=? order by j.nombre;", [ id_club, id_contempla], (err, results) => {
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

//------------------------ MODIFICAR ESTADO JUGADOR---------------------------------------------------
router.patch('/updateEstado', (req, res, next) => {
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
            return errorBD(res, err);
        }
    })
})

//------------------------ ELIMINAR JUGADOR-EQUIPO --------------------------------------------------------

router.delete('/delete/:id_club/:id_contempla/:ci', soloSuClub((req) => req.params.id_club), (req, res, next) => {
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
            return errorBD(res, err);
        }
    })
})

module.exports = router;