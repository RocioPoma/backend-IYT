const express = require('express');
const connection =require('../connection');
const { errorBD } = require('../libs/errores');
const router = express.Router();


//------------------------ AGREGAR SERIE---------------------------------------------------
router.post('/add',(req,res,next)=>{
    let serie = req.body;
    const query = "insert into serie (nombre,estado) value(?,'true')";
    connection.query(query,[serie.nombre],(err,results)=>{
        if(!err){
            return res.status(200).json({message:"Serie agregado con exito"});
        }
        else{
            return errorBD(res, err);
        }
    })
})

//------------------------ LISTAR SERIE ---------------------------------------------------
router.get('/get',(req,res,next)=>{
    var query = "select * from serie order by nombre";
    connection.query(query,(err,results)=>{
        if(!err){
            return res.status(200).json(results);
        }
        else{
            return errorBD(res, err);
        }
    })
})

//------------------------ MODIFICAR SERIE ---------------------------------------------------
router.patch('/update',(req,res,next)=>{
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
            return errorBD(res, err);
        }
    })
})

//------------ ELIMINAR SERIE---------------------------------------------------------------------------

router.delete('/delete/:id_serie',(req,res,next)=>{
    const id_serie = req.params.id_serie;
    var query = "delete from serie where id_serie=?";
    connection.query(query,[id_serie],(err,results)=>{
        if(!err){
            if(results.affectedRows == 0){
                return res.status(404).json({message:"Id Serie no encontrado"});
            }
            return res.status(200).json({message:"Serie eliminado con éxito"});
        }
        else{
            return errorBD(res, err);
        }
    })
})

//------------------CAMBIAR ESTADO DE SERIE ---------------------------------------------------
router.patch('/updateStatus', (req, res, next) => {
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
            return errorBD(res, err);
        }
    })
})


module.exports = router;