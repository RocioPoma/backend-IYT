const express = require("express");
const connection = require('../connection');
const router = express.Router();
var auth = require('../services/authentication');
var checkRole = require('../services/checkRole');
const multer = require('../libs/multer');
const fs = require('fs');

//-------------------------------- MOSTRAR/LISTAR ARBITRO-----------------------
router.get("/get", auth.authenticateToken, (req, res) => {
    connection.query('SELECT * FROM  ARBITRO', (err, results) => {
        if (!err) {
            return res.status(200).json(results);
        }
        else {
            return res.status(500).json(err);
        }
    });
});

//-------------------------------- AGREGAR ARBITRO--------------------------------
router.post('/add', auth.authenticateToken, (req, res, next) => {
    let arbitro = req.body;
    let datos = {};
    datos = {
        ci: arbitro.ci,
        nombre: arbitro.nombre,
        ap_paterno: arbitro.ap_paterno,
        ap_materno: arbitro.ap_materno,
        telefono: arbitro.telefono,
        funcion: arbitro.funcion,
        estado: 'true'
    }
    console.log(datos);
    connection.query('insert into arbitro set ?', [datos], (err, results) => {
        if (!err) {
            return res.status(200).json({ message: "Arbitro agregado con exito" });
        }
        else {
            return res.status(500).json(err);
        }
    });
});


//------------------------ MODIFICAR ARBITRO---------------------------------------------------
router.patch('/update', auth.authenticateToken, (req, res, next) => {
    let arbitro = req.body;
    let datos = {};
    datos = {
        ci: arbitro.ci,
        nombre: arbitro.nombre,
        ap_paterno: arbitro.ap_paterno,
        ap_materno: arbitro.am_materno,
        telefono: arbitro.telefono,
        funcion: arbitro.funcion
    }
    var query = "update arbitro set ci=?,nombre=?,ap_paterno=?, ap_materno=?,telefono=?,funcion=? where ci=?";
    connection.query(query, [datos.ci,datos.nombre, datos.ap_paterno,datos.ap_materno,datos.telefono,datos.funcion, datos.ci], (err, results) => {
        if (!err) {
            if (results.affectedRows == 0) {
                return res.status(404).json({ message: "CI Arbitro no encontrado" });
            }
            return res.status(200).json({ message: "Arbitro actualizado con exito" });
        }
        else {
            return res.status(500).json(err);
        }
    })
})
//-----------------------------------------------------------------------------------------------------------

//------------ ELIMINAR ARBITRO---------------------------------------------------------------------------

router.delete('/delete/:ci', auth.authenticateToken, (req, res, next) => {
    const ci = req.params.ci;
    var query = "delete from arbitro where ci=?";
    connection.query(query, [ci], (err, results) => {
        if (!err) {
            if (results.affectedRows == 0) {
                return res.status(404).json({ message: "CI Arbitro no encontrado" });
            }
            return res.status(200).json({ message: "Arbitro eliminado con éxito" });
        }
        else {
            return res.status(500).json(err);
        }
    })
})

//-------------------------------------------------------------------------------------------------------------


//------------------CAMBIAR ESTADO DE ARBITRO---------------------------------------------------
router.patch('/updateStatus', auth.authenticateToken, checkRole.checkRole, (req, res, next) => {
    let arbitro = req.body;
    var query = "update arbitro set estado=? where ci=?";
    connection.query(query, [arbitro.status, arbitro.ci], (err, results) => {
        if (!err) {
            if (results.affectedRows == 0) {
                return res.status(404).json({ message: "CI Arbitro no encontrado" });
            }
            return res.status(200).json({ message: "Estado Arbitro actualizado con éxito" });
        }
        else {
            return res.status(500).json(err);
        }
    })
})

//------------------------ OBTENER ARBITRO SEGUN CI ---------------------------------------------------
router.get('/getByCi/:ci', auth.authenticateToken, (req, res, next) => {
    const ci = req.params.ci;
    var query = "select * from arbitro where ci=?";
    connection.query(query, [ci], (err, results) => {
        if (!err) {
            return res.status(200).json(results[0]);
        }
        else {
            return res.status(500).json(err);
        }
    })
})

module.exports = router;