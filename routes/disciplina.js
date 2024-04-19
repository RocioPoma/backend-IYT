const express = require("express");
const connection = require('../connection');
const router = express.Router();
var auth = require('../services/authentication');
var checkRole = require('../services/checkRole');


//-------------------------------- MOSTRAR/LISTAR TODAS LAS DISCIPLINAS-----------------------
router.get("/get_all", auth.authenticateToken, (req, res) => {
    connection.query('SELECT * FROM  DISCIPLINA', (err, results) => {
        if (!err) {
            return res.status(200).json(results);
        }
        else {
            return res.status(500).json(err);
        }
    });
});

//-------------------------------- MOSTRAR/LISTAR DISCIPLINAS HABILITADAS -----------------------
router.get("/get", auth.authenticateToken, (req, res) => {
    connection.query("SELECT * FROM  DISCIPLINA WHERE estado='true'", (err, results) => {
        if (!err) {
            return res.status(200).json(results);
        }
        else {
            return res.status(500).json(err);
        }
    });
});


//------------------CAMBIAR ESTADO DISCIPLINA---------------------------------------------------
router.patch('/updateStatus', auth.authenticateToken, checkRole.checkRole, (req, res, next) => {
    let disciplina = req.body;
    var query = "update disciplina set estado=? where id=?";
    connection.query(query, [disciplina.status, disciplina.id], (err, results) => {
        if (!err) {
            if (results.affectedRows == 0) {
                return res.status(404).json({ message: "ID disciplina no encontrado" });
            }
            return res.status(200).json({ message: "Estado disciplina actualizado con éxito" });
        }
        else {
            return res.status(500).json(err);
        }
    })
})

//------------------------ OBTENER DISCIPLINA SEGUN ID ---------------------------------------------------
router.get('/getByID/:id', auth.authenticateToken, (req, res, next) => {
    const id = req.params.id;
    var query = "select * from disciplina where id=?";
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