const express = require("express");
const connection = require('../connection');
const router = express.Router();
const multer = require('../libs/multer');
const fs = require('fs');

//-------------------------------- AGREGAR NOTICIA --------------------------------
router.post('/add', multer.single('imagen'), (req, res, next) => {
    const file = req.file;
    let noticia = req.body;
    //console.log(file);
    let datos = {};

    if (!file) {
        datos = {
            titulo: noticia.titulo,
            imagen: '',
            descripcion: noticia.descripcion,
            id_campeonato: noticia.id_campeonato
        }
    } else {
        datos = {
            titulo: noticia.titulo,
            imagen: req.file.filename,
            descripcion: noticia.descripcion,
            id_campeonato: noticia.id_campeonato
        }
    }
    //console.log(datos);
    connection.query('insert into noticia set ?', [datos], (err, results) => {
        if (!err) {
            return res.status(200).json({ message: "Noticia agregado con exito" });
        }
        else {
            return res.status(500).json(err);
        }
    });
    console.log('Agregado Correctamente');
    /* query = "insert into noticia (titulo,imagen,descripcion,documento) value(?,?,?,?)";
     connection.query(query,[noticia.titulo,req.file.path,noticia.descripcion,noticia.documento],(err,results)=>{
         if(!err){
             return res.status(200).json({message:"Noticia agregado con exito"});
         }
         else{
             return res.status(500).json(err);
         }
     })*/
});

//-------------------------------- MOSTRAR/LISTAR NOTICIA --------------------------------
router.get("/get", (req, res) => {
    connection.query('SELECT * FROM  noticia', (err, results) => {
        if (!err) {
            return res.status(200).json(results);
        }
        else {
            return res.status(500).json(err);
        }
    });
});

router.get('/getById/:id', (req, res, next) => {
    const { id } = req.params;
    connection.query('SELECT * FROM  noticia WHERE id = ?', [id], (err, results) => {
        if (!err) {
            return res.status(200).json(results[0]);
        }
        else {
            return res.status(500).json(err);
        }
    })
})


//-------------------------------- MODIFICAR NOTICIAS---------------------------------------------------
/*
router.patch('/update', (req, res, next) => {
    let noticia = req.body;
    console.log(noticia);
    var query = "update noticia set titulo=?,descripcion=? where id=?";
    connection.query(query, [noticia.titulo, noticia.descripcion, noticia.id], (err, results) => {
        if (!err) {
            if (results.affectedRows == 0) {
                return res.status(404).json({ message: "Noticia Id no encontrado" });
            }
            return res.status(200).json({ message: "Noticia actualizado con exito" });
        }
        else {
            return res.status(500).json(err);
        }
    })
})*/

router.patch('/update',multer.single('imagen'), (req, res, next) => {
    const file = req.file;
    let noticia = req.body;
    let datos = {};

    if (!file) {
        datos = {
            id:noticia.id,
            titulo: noticia.titulo,
            descripcion: noticia.descripcion,
            imagen: noticia.nombreimg,
        }
    } else {
        datos = {
            id:noticia.id,
            titulo: noticia.titulo,
            descripcion: noticia.descripcion,
            imagen: req.file.filename,
        }
    }

    var query = "update noticia set titulo=?,descripcion=?,imagen=? where id=?";
    connection.query(query, [datos.titulo,datos.descripcion,datos.imagen,datos.id], (err, results) => {
        if (!err) {
            if (results.affectedRows == 0) {
                return res.status(404).json({ message: "Noticia Id no encontrado" });
            }
            return res.status(200).json({ message: "Noticia actualizado con exito" });
        }
        else {
            return res.status(500).json(err);
        }
    })
})


//-------------------------------- ELIMINAR NOTICIA -----------------------------------------------------
router.delete('/delete/:id', (req, res) => {
    const { id } = req.params;
    deleteFile(id);
    connection.query('DELETE FROM noticia WHERE id = ?', [id], (err, results) => {
        if (!err) {
            if (results.affectedRows == 0) {
                return res.status(404).json({ message: "Noticia ID no encontrado" });
            }
            return res.status(200).json({ message: "Noticia eliminado con exito" });
        }
        else {
            return res.status(500).json(err);
        }
    });
});

//---funcion para eliminar archivo
function deleteFile(id) {
    connection.query('SELECT * FROM  noticia WHERE id = ?', [id], (err, rows, fields) => {
        [{ imagen }] = rows;
        if(imagen ===''){
            console.log('noticia eliminado');
        }else{
            fs.unlinkSync('./uploads/img/' + imagen);
            
        }
    });
}



//-------------------------------- LISTAR NOTICIA DE UN CAMPEONATO ESPECIFICO-----------------------------------------------------
router.get('/getnoticiacampeonato/:id_campeonato', (req, res, next) => {
    const { id_campeonato } = req.params;
    connection.query('select * from noticia  where id_campeonato= ?', [id_campeonato], (err, results) => {
        if (!err) {
            return res.status(200).json(results);
        }
        else {
            return res.status(500).json(err);
        }
    })
})

module.exports = router;