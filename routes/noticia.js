const express = require("express");
const connection = require('../connection');
const { errorBD } = require('../libs/errores');
const router = express.Router();
const multer = require('../libs/multer');
const { eliminarConArchivos, reemplazarArchivo } = require('../libs/archivos');

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
            return errorBD(res, err);
        }
    });
    /* query = "insert into noticia (titulo,imagen,descripcion,documento) value(?,?,?,?)";
     connection.query(query,[noticia.titulo,req.file.path,noticia.descripcion,noticia.documento],(err,results)=>{
         if(!err){
             return res.status(200).json({message:"Noticia agregado con exito"});
         }
         else{
             return errorBD(res, err);
         }
     })*/
});

//-------------------------------- MOSTRAR/LISTAR NOTICIA --------------------------------
router.get("/get", (req, res) => {
    connection.query("SELECT n.*, DATE_FORMAT(n.fecha_registro, '%d-%m-%Y %H:%i') AS fecha FROM noticia n ORDER BY n.fecha_registro DESC, n.id DESC", (err, results) => {
        if (!err) {
            return res.status(200).json(results);
        }
        else {
            return errorBD(res, err);
        }
    });
});

router.get('/getById/:id', (req, res, next) => {
    const { id } = req.params;
    connection.query("SELECT n.*, DATE_FORMAT(n.fecha_registro, '%d-%m-%Y %H:%i') AS fecha FROM noticia n WHERE n.id = ?", [id], (err, results) => {
        if (!err) {
            return res.status(200).json(results[0]);
        }
        else {
            return errorBD(res, err);
        }
    })
})


//-------------------------------- MODIFICAR NOTICIAS---------------------------------------------------
/*
router.patch('/update', (req, res, next) => {
    let noticia = req.body;
    var query = "update noticia set titulo=?,descripcion=? where id=?";
    connection.query(query, [noticia.titulo, noticia.descripcion, noticia.id], (err, results) => {
        if (!err) {
            if (results.affectedRows == 0) {
                return res.status(404).json({ message: "Noticia Id no encontrado" });
            }
            return res.status(200).json({ message: "Noticia actualizado con exito" });
        }
        else {
            return errorBD(res, err);
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
            if (file) reemplazarArchivo(noticia.nombreimg, datos.imagen);
            return res.status(200).json({ message: "Noticia actualizado con exito" });
        }
        else {
            return errorBD(res, err);
        }
    })
})


//-------------------------------- ELIMINAR NOTICIA -----------------------------------------------------
router.delete('/delete/:id', async (req, res, next) => {
    try {
        const r = await eliminarConArchivos('noticia', 'id', req.params.id, ['imagen']);
        if (r.affectedRows == 0) {
            return res.status(404).json({ message: "Noticia ID no encontrado" });
        }
        return res.status(200).json({ message: "Noticia eliminado con exito" });
    } catch (err) {
        next(err);
    }
});



//-------------------------------- LISTAR NOTICIA DE UN CAMPEONATO ESPECIFICO-----------------------------------------------------
router.get('/getnoticiacampeonato/:id_campeonato', (req, res, next) => {
    const { id_campeonato } = req.params;
    connection.query("SELECT n.*, DATE_FORMAT(n.fecha_registro, '%d-%m-%Y %H:%i') AS fecha FROM noticia n WHERE n.id_campeonato = ? ORDER BY n.fecha_registro DESC, n.id DESC", [id_campeonato], (err, results) => {
        if (!err) {
            return res.status(200).json(results);
        }
        else {
            return errorBD(res, err);
        }
    })
})

module.exports = router;