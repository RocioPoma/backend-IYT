const express = require("express");
const connection = require('../connection');
const { errorBD } = require('../libs/errores');
const router = express.Router();


//-------------------------------- MOSTRAR/LISTAR TODAS LAS DISCIPLINAS-----------------------
router.get("/get_all",  (req, res) => {
    connection.query('SELECT * FROM  disciplina', (err, results) => {
        if (!err) {
            return res.status(200).json(results);
        }
        else {
            return errorBD(res, err);
        }
    });
});

//-------------------------------- MOSTRAR/LISTAR DISCIPLINAS HABILITADAS -----------------------
router.get("/get",  (req, res) => {
    connection.query("SELECT * FROM  disciplina WHERE estado='true'", (err, results) => {
        if (!err) {
            return res.status(200).json(results);
        }
        else {
            return errorBD(res, err);
        }
    });
});


//------------------CAMBIAR ESTADO DISCIPLINA---------------------------------------------------
router.patch('/updateStatus', (req, res, next) => {
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
            return errorBD(res, err);
        }
    })
})

//------------------------ OBTENER DISCIPLINA SEGUN ID ---------------------------------------------------
router.get('/getByID/:id', (req, res, next) => {
    const id = req.params.id;
    var query = "select * from disciplina where id=?";
    connection.query(query, [id], (err, results) => {
        if (!err) {
            return res.status(200).json(results[0]);
        }
        else {
            return errorBD(res, err);
        }
    })
})

module.exports = router;