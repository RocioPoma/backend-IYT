const express = require("express");
const connection = require('../connection');
const router = express.Router();
var auth = require('../services/authentication');
var checkRole = require('../services/checkRole');

//-------------------------------- MOSTRAR/LISTAR -----------------------
router.get("/get_all",  (req, res) => {
    connection.query('SELECT * FROM  categoria', (err, results) => {
        if (!err) {
            return res.status(200).json(results);
        }
        else {
            return res.status(500).json(err);
        }
    });
});

//-------------------------------- MOSTRAR/LISTAR SOLO LOS HABILITADOS-----------------------
router.get("/get",  (req, res) => {
    connection.query("SELECT * FROM  categoria WHERE estado='true'", (err, results) => {
        if (!err) {
            return res.status(200).json(results);
        }
        else {
            return res.status(500).json(err);
        }
    });
});

//-------------------------------- AGREGAR --------------------------------
router.post('/add', auth.authenticateToken, (req, res, next) => {
    let categoria = req.body;
    let datos = {};

    datos = {
        nombre: categoria.nombre,
        estado: 'true'
    }
    //console.log(datos);
    connection.query('insert into categoria set ?', [datos], (err, results) => {
        if (!err) {
            return res.status(200).json({ message: "Categoria agregado con exito" });
        }
        else {
            return res.status(500).json(err);
        }
    });
});


//------------------------ MODIFICAR ---------------------------------------------------
router.patch('/update', auth.authenticateToken, (req, res, next) => {
    let categoria = req.body;
    let datos = {};

        datos = {
            id: categoria.id,
            nombre: categoria.nombre
        }

    var query = "update categoria set nombre=? where id=?";
    connection.query(query, [datos.nombre, datos.id], (err, results) => {
        if (!err) {
            if (results.affectedRows == 0) {
                return res.status(404).json({ message: "Id categoria no encontrado" });
            }
            return res.status(200).json({ message: "Categoria Actualizado con exito" });
        }
        else {
            return res.status(500).json(err);
        }
    })
})

//-----------------------------------------------------------------------------------------------------------

//------------ ELIMINAR---------------------------------------------------------------------------

router.delete('/delete/:id', auth.authenticateToken, (req, res, next) => {
    const id = req.params.id;
    var query = "delete from categoria where id=?";
    connection.query(query, [id], (err, results) => {
        if (!err) {
            if (results.affectedRows == 0) {
                return res.status(404).json({ message: "Id categoria no encontrado" });
            }
            return res.status(200).json({ message: "Categoria eliminado con éxito" });
        }
        else {
            return res.status(500).json(err);
        }
    })
})

//-------------------------------------------------------------------------------------------------

//------------------ CAMBIAR ESTADO ----------------------------------------------------------------
router.patch('/updateStatus', auth.authenticateToken, checkRole.checkRole, (req, res, next) => {
    let categoria = req.body;
    var query = "update categoria set estado=? where id=?";
    connection.query(query, [categoria.status, categoria.id], (err, results) => {
        if (!err) {
            if (results.affectedRows == 0) {
                return res.status(404).json({ message: "Id categoria no encontrado" });
            }
            return res.status(200).json({ message: "Estado categoria actualizado con éxito" });
        }
        else {
            return res.status(500).json(err);
        }
    })
})

//------------------------ OBTENER  SEGUN ID ---------------------------------------------------
router.get('/getById/:id', auth.authenticateToken, (req, res, next) => {
    const id = req.params.id;
    var query = "select * from categoria where id=?";
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