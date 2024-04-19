const express = require('express');
const connection =require('../connection');
const router = express.Router();
var auth = require('../services/authentication');
var checkRole = require('../services/checkRole');


//------------------------ AGREGAR SERIE---------------------------------------------------
router.post('/add',auth.authenticateToken,checkRole.checkRole,(req,res,next)=>{
    let serie = req.body;
    query = "insert into serie (nombre,estado) value(?,'true')";
    connection.query(query,[serie.nombre],(err,results)=>{
        if(!err){
            return res.status(200).json({message:"Serie agregado con exito"});
        }
        else{
            return res.status(500).json(err);
        }
    })
})

//------------------------ LISTAR SERIE ---------------------------------------------------
router.get('/get',auth.authenticateToken,(req,res,next)=>{
    var query = "select * from serie order by nombre";
    connection.query(query,(err,results)=>{
        if(!err){
            return res.status(200).json(results);
        }
        else{
            return res.status(500).json(err);
        }
    })
})

//------------------------ MODIFICAR SERIE ---------------------------------------------------
router.patch('/update',auth.authenticateToken,checkRole.checkRole,(req,res,next)=>{
    let serie =req.body;
    var query = "update serie set nombre=? where id_serie=?";
    connection.query(query,[serie.nombre,serie.id_serie],(err,results)=>{
        if(!err){
            if(results.affectedRows == 0){
                return res.status(404).json({message:"Serie Id no encontrado"});
            }
            return res.status(200).json({message:"Serie actualizado con exito"});
        }
        else{
            return res.status(500).json(err);
        }
    })
})

//------------ ELIMINAR SERIE---------------------------------------------------------------------------

router.delete('/delete/:id_serie',auth.authenticateToken,(req,res,next)=>{
    const id_serie = req.params.id_serie;
    var query = "delete from serie where id_serie=?";
    connection.query(query,[id],(err,results)=>{
        if(!err){
            if(results.affectedRows == 0){
                return res.status(404).json({message:"Id Serie no encontrado"});
            }
            return res.status(200).json({message:"Serie eliminado con éxito"});
        }
        else{
            return res.status(500).json(err);
        }
    })
})

//------------------CAMBIAR ESTADO DE SERIE ---------------------------------------------------
router.patch('/updateStatus', auth.authenticateToken, checkRole.checkRole, (req, res, next) => {
    let serie = req.body;
    var query = "update serie set estado=? where id_serie=?";
    connection.query(query, [serie.status, serie.id_serie], (err, results) => {
        if (!err) {
            if (results.affectedRows == 0) {
                return res.status(404).json({ message: "Id serie no encontrado" });
            }
            return res.status(200).json({ message: "Estado Serie actualizado con éxito" });
        }
        else {
            return res.status(500).json(err);
        }
    })
})


module.exports = router;