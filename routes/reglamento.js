const express = require("express");
const connection = require('../connection');
const router = express.Router();
var auth = require('../services/authentication');
var checkRole = require('../services/checkRole');
const multer = require('../libs/multer');
const fs = require('fs');

//-------------------------------- MOSTRAR/LISTAR REGLAMENTO -----------------------
router.get("/get", auth.authenticateToken, (req, res) => {
    connection.query('SELECT * FROM  reglamento', (err, results) => {
        if (!err) {
            return res.status(200).json(results);
        }
        else {
            return res.status(500).json(err);
        }
    });
});

//-------------------------------- AGREGAR REGLAMENTO--------------------------------
router.post('/add', multer.single('documento'), auth.authenticateToken, (req, res, next) => {
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
            return res.status(500).json(err);
        }
    });
    console.log('Agregado Correctamente');
});


//------------------------ MODIFICAR REGLAMENTO---------------------------------------------------
router.patch('/update',multer.single('documento'), auth.authenticateToken, (req, res, next) => {
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
            return res.status(500).json(err);
        }
    })
})

//-----------------------------------------------------------------------------------------------------------

//------------ ELIMINAR REGLAMENTO---------------------------------------------------------------------------

router.delete('/delete/:id',auth.authenticateToken,(req,res,next)=>{
    const id = req.params.id;
    deleteFile(id);
    var query = "delete from reglamento where id=?";
    connection.query(query,[id],(err,results)=>{
        if(!err){
            if(results.affectedRows == 0){
                return res.status(404).json({message:"Id Reglamento no encontrado"});
            }
            return res.status(200).json({message:"Reglamento eliminado con éxito"});
        }
        else{
            console.error(error.message);
            return res.status(500).json(err);
        }
    })
})

function deleteFile(id) { 
    connection.query('SELECT * FROM reglamento WHERE id = ?', [id], (err, rows, fields) => {
        if (err) throw err;

        if (rows.length > 0) {
            const [{ documento }] = rows;
            console.log("Documento: " + documento);

            const filePath = './uploads/img/' + documento;

            if (!fs.existsSync(filePath)) {
                console.log('Documento eliminado');
            } else {
                fs.unlinkSync(filePath);
                console.log('Documento eliminado del sistema de archivos');
            }
        } else {
            console.log('No se encontró el documento en la base de datos');
        }
    });
}
//-------------------------------------------------------------------------------------------------------------


//------------------CAMBIAR ESTADO DE REGLAMENTO---------------------------------------------------
router.patch('/updateStatus',auth.authenticateToken,checkRole.checkRole,(req,res,next)=>{
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
            return res.status(500).json(err);
        }
    })
})

//------------------------ OBTENER REGLAMENTO SEGUN ID ---------------------------------------------------
router.get('/getById/:id',auth.authenticateToken,(req,res,next)=>{
    const id = req.params.id;
    var query = "select * from reglamento where id=?";
    connection.query(query,[id],(err,results)=>{
        if(!err){
            return res.status(200).json(results[0]);
        }
        else{
            return res.status(500).json(err);
        }
    })
})

module.exports = router;