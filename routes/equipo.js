const express = require("express");
const connection = require('../connection');
const router = express.Router();
var auth = require('../services/authentication');
var checkRole = require('../services/checkRole');

//-------------------------------- MOSTRAR/LISTAR -----------------------
router.get("/get_all", auth.authenticateToken, (req, res) => {
    connection.query('select  e.*, b.nombre as nombre_club'
        + 'from equipo e, club b'
        + 'where e.id_club=b.id', (err, results) => {
            if (!err) {
                return res.status(200).json(results);
            }
            else {
                return res.status(500).json(err);
            }
        });
});

//-------------------------------- LISTAR EQUIPO DE UNA CATEGORIA ESPECIFICO-----------------------------------------------------
router.get('/get/:id_contempla', auth.authenticateToken, (req, res, next) => {
    const { id_contempla } = req.params;
    connection.query('select  e.*, b.nombre as nombre_club, b.comunidad '
    + 'from equipo e, club b '
    + 'where e.id_club=b.id and e.id_contempla=?', [id_contempla], (err, results) => {
            if (!err) {
                return res.status(200).json(results);
            }
            else {
                return res.status(500).json(err);
            }
        })
})


//-------------------------------- AGREGAR --------------------------------
router.post('/add', auth.authenticateToken, (req, res, next) => {
    let equipo = req.body;
    let datos = {};
    let id_serie=equipo.id_serie;
    if(equipo.id_serie==''){id_serie=0}

    datos = {
        id_club: equipo.id_club,
        id_contempla: equipo.id_contempla,
        id_serie: id_serie,
        numero_sorteo: equipo.numero_sorteo
        //estado: 'true' 
    }
    console.log(datos);
    connection.query('insert into equipo set ?', [datos], (err, results) => {
        if (!err) {
            return res.status(200).json({ message: "Equipo agregado con exito" });
        }
        else {
            return res.status(500).json(err);
        }
    });
});


//------------------------ MODIFICAR ---------------------------------------------------
router.patch('/update', auth.authenticateToken, (req, res, next) => {
    let equipo = req.body;
    let datos = {};
    let id_serie=equipo.id_serie;
    if(equipo.id_serie==null){id_serie=0}

    datos = {
        id_club: equipo.id_club,
        id_contempla: equipo.id_contempla,
        id_clubNew: equipo.id_clubNew,
        id_serie: id_serie,
        numero_sorteo: equipo.numero_sorteo
    }
   console.log(datos);

    var query = "update equipo set id_club=?,id_serie=?,numero_sorteo=? where id_club=? and id_contempla=?";
    connection.query(query, [datos.id_clubNew, datos.id_serie,datos.numero_sorteo, datos.id_club, datos.id_contempla], (err, results) => {
        if (!err) {
            if (results.affectedRows == 0) {
                return res.status(404).json({ message: "Id Equipo no encontrado" });
            }
            return res.status(200).json({ message: "Equipo Actualizado con exito" });
        }
        else {
            return res.status(500).json(err);
        }
    })
})

//-----------------------------------------------------------------------------------------------------------

//------------ ELIMINAR---------------------------------------------------------------------------

router.delete('/delete/:id_club/:id_contempla', auth.authenticateToken, (req, res, next) => {
    const id_club = req.params.id_club;
    const id_contempla = req.params.id_contempla;
    var query = "delete from equipo where id_club=? and id_contempla=?";
    connection.query(query, [id_club,id_contempla], (err, results) => {
        if (!err) {
            if (results.affectedRows == 0) {
                return res.status(404).json({ message: "Id Equipo no encontrado" });
            }
            return res.status(200).json({ message: "Equipo eliminado con éxito" });
        }
        else {
            return res.status(500).json(err);
        }
    })
})

//-------------------------------------------------------------------------------------------------


//------------------------ OBTENER  SEGUN ID ---------------------------------------------------
router.get('/getById/:id', auth.authenticateToken, (req, res, next) => {
    const id = req.params.id;
    var query = "select * from equipo where id=?";
    connection.query(query, [id], (err, results) => {
        if (!err) {
            return res.status(200).json(results[0]);
        }
        else {
            return res.status(500).json(err);
        }
    })
})

module.exports = router;