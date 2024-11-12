const express = require('express');
const connection =require('../connection');
const router = express.Router();
var auth = require('../services/authentication');
var checkRole = require('../services/checkRole');

//----------para archivos-----------------------------------------------------------------------------
const multer = require('../libs/multer');
const fs = require('fs');
//-----------------------------------------------------------------------------------------------------

//------------LISTAR CAMPEONATO------------------------------------------------------------------------
router.get('/get',(req,res,next)=>{
    console.log("LLEGO AQUI")
    var query = "SELECT id,nombre_campeonato, fecha_inicio,fecha_fin, DATE_FORMAT(fecha_inicio, '%d-%m-%Y') as fecha_i,DATE_FORMAT(fecha_fin, '%d-%m-%Y') as fecha_f, convocatoria,gestion, status"
    +" FROM campeonato order by gestion DESC";
    connection.query(query,(err,results)=>{
        if(!err){
            return res.status(200).json(results);
        }
        else{
            return res.status(500).json(err);
        }
    })
})

//------------AGREGAR CAMPEONATO------------------------------------------------------------------------
router.post('/add', multer.single('convocatoria'), auth.authenticateToken, checkRole.checkRole, (req, res, next) => {
    const file = req.file;
    let campeonato = req.body;
    let datos = {};
    let fecha_i= new Date(campeonato.fecha_inicio); //convierte a tipo fecha
    let fecha_f= new Date(campeonato.fecha_fin); //convierte a tipo fecha

    if (!file) {
        datos = {
            nombre_campeonato: campeonato.nombre_campeonato,
            fecha_inicio: fecha_i, //convierte a tipo fecha segun la ISO
            fecha_fin: fecha_f, //convierte a tipo fecha segun la ISO
            convocatoria:'',
            gestion: campeonato.gestion,
            status:'true'
        }
    } else {
        datos = {
            nombre_campeonato: campeonato.nombre_campeonato,
            fecha_inicio: fecha_i, //convierte a tipo fecha segun la ISO
            fecha_fin: fecha_f, //convierte a tipo fecha segun la ISO
            convocatoria:req.file.filename,
            gestion: campeonato.gestion,
            status:'true'
        }
    }
    console.log(datos);
    connection.query('insert into campeonato set ?', [datos], (err, results) => {
        if (!err) {
            return res.status(200).json({ message: "Campeonato agregado con exito"});
        }
        else {
            return res.status(500).json(err);
        }
    });
})
/*router.post('/add',auth.authenticateToken,checkRole.checkRole,(req,res)=>{
    let campeonato = req.body;
    query = "insert into campeonato (nombre_campeonato,fecha_inicio,fecha_fin,convocatoria,gestion,status) values(?,?,?,?,?,'true')";
    connection.query(query,[campeonato.nombre_campeonato,campeonato.fecha_inicio,campeonato.fecha_fin,campeonato.convocatoria,campeonato.gestion],(err,results)=>{
        if(!err){
            return res.status(200).json({message:"Campeonato agregado con exito"});
        }
        else{
            return res.status(500).json(err);
        }
    })
})*/


//------------------------ MODIFICAR CAMPEONATO---------------------------------------------------
router.patch('/update',multer.single('convocatoria'), auth.authenticateToken, checkRole.checkRole, (req, res, next) => {
    const file = req.file;
    let campeonato = req.body;
    let datos = {};
    let fecha_i= new Date(campeonato.fecha_inicio); //convierte a tipo fecha
    let fecha_f= new Date(campeonato.fecha_fin); //convierte a tipo fecha

    if (!file) {
        datos = {
            id: campeonato.id,
            nombre_campeonato: campeonato.nombre_campeonato,
            fecha_inicio: fecha_i, 
            fecha_fin: fecha_f, 
            convocatoria:campeonato.nombre_conv,
            gestion: campeonato.gestion
        }
    } else {
        datos = {
            id: campeonato.id,
            nombre_campeonato: campeonato.nombre_campeonato,
            fecha_inicio: fecha_i, 
            fecha_fin: fecha_f, 
            convocatoria:req.file.filename,
            gestion: campeonato.gestion
        }
    }     
    var query = "update campeonato set nombre_campeonato=?,fecha_inicio=?,fecha_fin=?,convocatoria=?,gestion=? where id=?";
    connection.query(query, [datos.nombre_campeonato, datos.fecha_inicio, datos.fecha_fin, datos.convocatoria, datos.gestion, datos.id], (err, results) => {
        if (!err) {
            if (results.affectedRows == 0) {
                return res.status(404).json({ message: "Id Campeonato no encontrado" });
            }
            return res.status(200).json({ message: "Campeonato Actualizado con exito" });
        }
        else {
            return res.status(500).json(err);
        }
    })
})
/*router.patch('/update',auth.authenticateToken,checkRole.checkRole,(req,res,next)=>{
    let campeonato =req.body;
    var query = "update campeonato set nombre_campeonato=?,fecha_inicio=?,fecha_fin=?,convocatoria=?,gestion=? where id=?";
    connection.query(query,[campeonato.nombre_campeonato, campeonato.fecha_inicio, campeonato.fecha_fin, campeonato.convocatoria, campeonato.gestion,campeonato.id],(err,results)=>{
        if(!err){
            if(results.affectedRows == 0){
                return res.status(404).json({message:"Campeonato Id no encontrado"});
            }
            return res.status(200).json({message:"Campeonato Actualizado con éxito"});
        }
        else{
            return res.status(500).json(err);
        }
    })
})*/

//-----------------------------------------------------------------------------------------------------------

//------------ ELIMINAR CAMPEONATO---------------------------------------------------------------------------
router.delete('/delete/:id',(req,res,next)=>{
    const id = req.params.id;
    deleteFile(id);
    var query = "delete from campeonato where id=?";
    connection.query(query,[id],(err,results)=>{
        if(!err){
            if(results.affectedRows == 0){
                return res.status(404).json({message:"Campeonato Id no encontrado"});
            }
            return res.status(200).json({message:"Campeonato eliminado con éxito"});
        }
        else{
            return res.status(500).json(err);
        }
    })
})

function deleteFile(id) {
    connection.query('SELECT * FROM  campeonato WHERE id = ?', [id], (err, rows, fields) => {
        [{ convocatoria }] = rows;
        console.log("Convocatoria: "+convocatoria);
        if(convocatoria ===''){
            console.log('Convocatoria eliminado');
        }else{
            fs.unlinkSync('./uploads/img/' + convocatoria);    
        }
    });
}
//------------------------------------------------------------------------------------------------



//------------------  CAMBIAR ESTADO CAMPEONATO ---------------------------------------------------
router.patch('/updateStatus',auth.authenticateToken,checkRole.checkRole,(req,res,next)=>{
    let campeonato =req.body;
    var query = "update campeonato set status=? where id=?";
    connection.query(query,[campeonato.status,campeonato.id],(err,results)=>{
        if(!err){
            if(results.affectedRows == 0){
                return res.status(404).json({message:"Campeonato Id no encontrado"});
            }
            return res.status(200).json({message:"Estado campeonato Actualizado con éxito"});
        }
        else{
            return res.status(500).json(err);
        }
    })
})

//------------------------ OBTENER CAMPEONATO SEGUN ID ---------------------------------------------------
router.get('/getByIdc/:id', auth.authenticateToken, (req, res, next) => {
    const id = req.params.id;
    console.log("ID: "+ id);
    var query = "select *, DATE_FORMAT(fecha_inicio, '%d-%m-%Y') as fecha_i,DATE_FORMAT(fecha_fin, '%d-%m-%Y') as fecha_f from campeonato where id=?";
    connection.query(query, [id], (err, results) => {
        if (!err) {
            return res.status(200).json(results[0]);
        }
        else {
            return res.status(500).json(err);
        }
    })
})
//-------------------------------todavia no se utilizo ----------------------------------------------
router.get('/getById/:id',auth.authenticateToken,(req,res,next)=>{
    const id = req.params.id;
    var query = "select id,nombre_campeonato,fecha_inicio,fecha_fin,convocatoria,gestion,status from campeonato where id=?";
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