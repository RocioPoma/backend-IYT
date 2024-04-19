const express = require("express");
const connection = require('../connection');
const router = express.Router();
var auth = require('../services/authentication');
var checkRole = require('../services/checkRole');

//CONTEMPLA CAMPEONATO, DISCIPLINA Y CATEGORIA
//-------------------------------- MOSTRAR/LISTAR TODOS LOS CATEGORIAS -----------------------
router.get("/get_all", auth.authenticateToken, (req, res) => {
    connection.query('select con.id, con.edad_min,con.edad_max,con.genero,camp.nombre_campeonato,'
        + ' d.nombre as nombre_disciplina, cat.nombre as nombre_categoria '
        + 'from contempla con, campeonato camp, disciplina d, categoria cat '
        + 'where con.id_campeonato=camp.id and con.id_disciplina=d.id and con.id_categoria=cat.id', (err, results) => {
            if (!err) {
                return res.status(200).json(results);
            }
            else {
                return res.status(500).json(err);
            }
        });
});

//-------------------------------- LISTAR CAT Y DISC  DE UN CAMPEONATO ESPECIFICO-----------------------------------------------------
router.get('/get/:id_campeonato', auth.authenticateToken, (req, res, next) => {
    const { id_campeonato } = req.params;
    connection.query('select con.id, con.edad_min,con.edad_max,con.genero,con.estado,con.id_disciplina,con.id_categoria,con.num_max_jugadores,con.sistema_de_juego,camp.nombre_campeonato, d.nombre as nombre_disciplina, cat.nombre as nombre_categoria '
        + 'from contempla con, campeonato camp, disciplina d, categoria cat '
        + 'where con.id_campeonato=camp.id and con.id_disciplina=d.id and con.id_categoria=cat.id and camp.id=?', [id_campeonato], (err, results) => {
            if (!err) {
                return res.status(200).json(results);
            }
            else {
                return res.status(500).json(err);
            }
        })
})

//-------------------------------- LISTAR DATOS  DE UNA CATEGORIA ESPECIFICA-----------------------------------------------------
router.get('/getById/:id', auth.authenticateToken, (req, res, next) => {
    const { id } = req.params;
    connection.query('select con.id, con.edad_min,con.edad_max,con.genero,con.estado,con.id_disciplina,con.id_categoria,con.num_max_jugadores,con.sistema_de_juego,con.requisito,con.edad_obligatoria,camp.nombre_campeonato, d.nombre as nombre_disciplina, cat.nombre as nombre_categoria '
        + 'from contempla con, campeonato camp, disciplina d, categoria cat '
        + 'where con.id_campeonato=camp.id and con.id_disciplina=d.id and con.id_categoria=cat.id and con.id=?', [id], (err, results) => {
            if (!err) {
                return res.status(200).json(results[0]);
            }
            else {
                return res.status(500).json(err);
            }
        })
})
//-------------------------------- AGREGAR --------------------------------
router.post('/add', auth.authenticateToken, (req, res, next) => {
    let dcat_campeonato = req.body;
    let datos = {};

    datos = {
        edad_min: dcat_campeonato.edad_min,
        edad_max: dcat_campeonato.edad_max,
        genero: dcat_campeonato.genero,
        id_campeonato: dcat_campeonato.id_campeonato,
        id_disciplina: dcat_campeonato.id_disciplina,
        id_categoria: dcat_campeonato.id_categoria,
        num_max_jugadores:dcat_campeonato.num_max_jugadores,
        sistema_de_juego: dcat_campeonato.sistema_de_juego,
        requisito: dcat_campeonato.requisito,
        edad_obligatoria: dcat_campeonato.edad_obligatoria,
        estado: 'true'
    }
    //console.log(datos);
    connection.query('insert into contempla set ?', [datos], (err, results) => {
        if (!err) {
            return res.status(200).json({ message: "Agregado con exito" });
        }
        else {
            return res.status(500).json(err);
        }
    });
});


//------------------------ MODIFICAR ---------------------------------------------------
router.patch('/update', auth.authenticateToken, (req, res, next) => {
    let dcat_campeonato = req.body;
    let datos = {};

    datos = {
        id: dcat_campeonato.id,
        edad_min: dcat_campeonato.edad_min,
        edad_max: dcat_campeonato.edad_max,
        genero: dcat_campeonato.genero,
        num_max_jugadores:dcat_campeonato.num_max_jugadores,
       // id_campeonato: dcat_campeonato.id_campeonato,
        id_disciplina: dcat_campeonato.id_disciplina,
        id_categoria: dcat_campeonato.id_categoria,
        sistema_de_juego: dcat_campeonato.sistema_de_juego,
        requisito: dcat_campeonato.requisito,
        edad_obligatoria: dcat_campeonato.edad_obligatoria
    }

    var query = "update contempla set edad_min=?,edad_max=?,genero=?,num_max_jugadores=?,id_disciplina=?,id_categoria=?,sistema_de_juego=?, requisito=?, edad_obligatoria=? where id=?";
    connection.query(query, [datos.edad_min,datos.edad_max,datos.genero,datos.num_max_jugadores,datos.id_disciplina,datos.id_categoria,datos.sistema_de_juego, datos.requisito, datos.edad_obligatoria, datos.id], (err, results) => {
        if (!err) {
            if (results.affectedRows == 0) {
                return res.status(404).json({ message: "Id no encontrado" });
            }
            return res.status(200).json({ message: "Actualizado con exito" });
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
    console.log("eliminar id "+ id);
    var query = "delete from contempla where id=?";
    connection.query(query, [id], (err, results) => {
        if (!err) {
            if (results.affectedRows == 0) {
                return res.status(404).json({ message: "Id  no encontrado" });
            }
            return res.status(200).json({ message: "Eliminado con éxito" });
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
    var query = "update contempla set estado=? where id=?";
    connection.query(query, [categoria.status, categoria.id], (err, results) => {
        if (!err) {
            if (results.affectedRows == 0) {
                return res.status(404).json({ message: "Id no encontrado" });
            }
            return res.status(200).json({ message: "Estado actualizado con éxito" });
        }
        else {
            return res.status(500).json(err);
        }
    })
})



module.exports = router;