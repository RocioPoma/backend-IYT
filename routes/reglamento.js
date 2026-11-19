const express = require("express");
const connection = require('../connection');
const { errorBD } = require('../libs/errores');
const router = express.Router();
const multer = require('../libs/multer');
const { eliminarConArchivos } = require('../libs/archivos');

//-------------------------------- MOSTRAR/LISTAR REGLAMENTO -----------------------
router.get("/get", (req, res) => {
    connection.query('SELECT * FROM  reglamento', (err, results) => {
        if (!err) {
            return res.status(200).json(results);
        }
        else {
            return errorBD(res, err);
        }
    });
});

//-------------------------------- AGREGAR REGLAMENTO--------------------------------
router.post('/add', multer.single('documento'), (req, res, next) => {
    const file = req.file;
    let reglamento = req.body;
    let datos = {};

    if (!file) {
        datos = {
            nombre: reglamento.nombre,
            documento: '',
            estado:'true'
        }
    } else {
        datos = {
            nombre: reglamento.nombre,
            documento: req.file.filename,
            estado:'true'
        }
    }
    //console.log(datos);
    connection.query('insert into reglamento set ?', [datos], (err, results) => {
        if (!err) {
            return res.status(200).json({ message: "Reglamento agregado con exito" });
        }
        else {
            return errorBD(res, err);
        }
    });
});


//------------------------ MODIFICAR REGLAMENTO---------------------------------------------------
router.patch('/update',multer.single('documento'), (req, res, next) => {
    const file = req.file;
    let reglamento = req.body;
    let datos = {};

    if (!file) {
        datos = {
            id: reglamento.id,
            nombre: reglamento.nombre,
            documento: reglamento.nombredoc
        }
    } else {
        datos = {
            id: reglamento.id,
            nombre: reglamento.nombre,
            documento: req.file.filename
        }
    }     
    var query = "update reglamento set nombre=?,documento=? where id=?";
    connection.query(query, [datos.nombre, datos.documento, datos.id], (err, results) => {
        if (!err) {
            if (results.affectedRows == 0) {
                return res.status(404).json({ message: "Id Reglamento no encontrado" });
            }
            return res.status(200).json({ message: "Reglamento Actualizado con exito" });
        }
        else {
            return errorBD(res, err);
        }
    })
})

//-----------------------------------------------------------------------------------------------------------

//------------ ELIMINAR REGLAMENTO---------------------------------------------------------------------------

router.delete('/delete/:id', async (req, res, next) => {
    try {
        const r = await eliminarConArchivos('reglamento', 'id', req.params.id, ['documento']);
        if (r.affectedRows == 0) {
            return res.status(404).json({ message: "Id Reglamento no encontrado" });
        }
        return res.status(200).json({ message: "Reglamento eliminado con éxito" });
    } catch (err) {
        next(err);
    }
});
//-------------------------------------------------------------------------------------------------------------


//------------------CAMBIAR ESTADO DE REGLAMENTO---------------------------------------------------
router.patch('/updateStatus',(req,res,next)=>{
    let reglamento =req.body;
    var query = "update reglamento set estado=? where id=?";
    connection.query(query,[reglamento.status,reglamento.id],(err,results)=>{
        if(!err){
            if(results.affectedRows == 0){
                return res.status(404).json({message:"Id Reglamento no encontrado"});
            }
            return res.status(200).json({message:"Estado Reglamento actualizado con éxito"});
        }
        else{
            return errorBD(res, err);
        }
    })
})

//------------------------ OBTENER REGLAMENTO SEGUN ID ---------------------------------------------------
router.get('/getById/:id',(req,res,next)=>{
    const id = req.params.id;
    var query = "select * from reglamento where id=?";
    connection.query(query,[id],(err,results)=>{
        if(!err){
            return res.status(200).json(results[0]);
        }
        else{
            return errorBD(res, err);
        }
    })
})

module.exports = router;