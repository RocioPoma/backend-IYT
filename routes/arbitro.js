const express = require("express");
const connection = require('../connection');
const { errorBD } = require('../libs/errores');
const router = express.Router();
const multer = require('../libs/multer');

//-------------------------------- MOSTRAR/LISTAR ARBITRO-----------------------
router.get("/get", (req, res) => {
    connection.query('SELECT * FROM arbitro', (err, results) => {
        if (!err) {
            return res.status(200).json(results);
        }
        else {
            return errorBD(res, err);
        }
    });
});

//-------------------------------- AGREGAR ARBITRO--------------------------------
router.post('/add', (req, res, next) => {
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
    connection.query('insert into arbitro set ?', [datos], (err, results) => {
        if (!err) {
            return res.status(200).json({ message: "Arbitro agregado con exito" });
        }
        else {
            return errorBD(res, err);
        }
    });
});


//------------------------ MODIFICAR ARBITRO---------------------------------------------------
router.patch('/update', (req, res, next) => {
    let arbitro = req.body;
    let datos = {};
    datos = {
        ci: arbitro.ci_mod || arbitro.ci,
        nombre: arbitro.nombre,
        ap_paterno: arbitro.ap_paterno,
        ap_materno: arbitro.ap_materno,
        telefono: arbitro.telefono,
        funcion: arbitro.funcion
    }
    var query = "update arbitro set ci=?,nombre=?,ap_paterno=?, ap_materno=?,telefono=?,funcion=? where ci=?";
    connection.query(query, [datos.ci,datos.nombre, datos.ap_paterno,datos.ap_materno,datos.telefono,datos.funcion, arbitro.ci], (err, results) => {
        if (!err) {
            if (results.affectedRows == 0) {
                return res.status(404).json({ message: "CI Arbitro no encontrado" });
            }
            return res.status(200).json({ message: "Arbitro actualizado con exito" });
        }
        else {
            return errorBD(res, err);
        }
    })
})
//-----------------------------------------------------------------------------------------------------------

//------------ ELIMINAR ARBITRO---------------------------------------------------------------------------

router.delete('/delete/:ci', (req, res, next) => {
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
            return errorBD(res, err);
        }
    })
})

//-------------------------------------------------------------------------------------------------------------


//------------------CAMBIAR ESTADO DE ARBITRO---------------------------------------------------
router.patch('/updateStatus', (req, res, next) => {
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
            return errorBD(res, err);
        }
    })
})

//------------------------ OBTENER ARBITRO SEGUN CI ---------------------------------------------------
router.get('/getByCi/:ci', (req, res, next) => {
    const ci = req.params.ci;
    var query = "select * from arbitro where ci=?";
    connection.query(query, [ci], (err, results) => {
        if (!err) {
            return res.status(200).json(results[0]);
        }
        else {
            return errorBD(res, err);
        }
    })
})

module.exports = router;