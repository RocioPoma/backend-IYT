const express = require('express');
const connection =require('../connection');
const router = express.Router();
var auth = require('../services/authentication');
var checkRole = require('../services/checkRole');


//------------------------ AGREGAR CLUBS---------------------------------------------------
router.post('/add',auth.authenticateToken,(req,res,next)=>{
    let club = req.body;
    query = "insert into club (nombre,comunidad) value(?,?)";
    connection.query(query,[club.nombre,club.comunidad],(err,results)=>{
        if(!err){
            return res.status(200).json({message:"Club agregado con exito"});
        }
        else{
            return res.status(500).json(err);
        }
    })
})

//------------------------ LISTAR CLUBS---------------------------------------------------
router.get('/get',auth.authenticateToken,(req,res,next)=>{
    var query = "select * from club order by nombre";
    connection.query(query,(err,results)=>{
        if(!err){
            return res.status(200).json(results);
        }
        else{
            return res.status(500).json(err);
        }
    })
})

//------------------------ LISTAR CLUBS SEGUN ID-------------------------------------------
router.get('/get/:id_club', auth.authenticateToken, (req, res, next) => {
    const { id_club } = req.params;
    connection.query('select * from club where id=?', [id_club], (err, results) => {
            if (!err) {
                return res.status(200).json(results);
            }
            else {
                return res.status(500).json(err);
            }
        })
})

//------------------------ MODIFICAR CLUBS---------------------------------------------------
router.patch('/update',auth.authenticateToken,(req,res,next)=>{
    let club =req.body;
    var query = "update club set nombre=?,comunidad=? where id=?";
    connection.query(query,[club.nombre,club.comunidad,club.id],(err,results)=>{
        if(!err){
            if(results.affectedRows == 0){
                return res.status(404).json({message:"Club Id no encontrado"});
            }
            return res.status(200).json({message:"Club actualizado con exito"});
        }
        else{
            return res.status(500).json(err);
        }
    })
})

//------------ ELIMINAR CLUB---------------------------------------------------------------------------

router.delete('/delete/:id',auth.authenticateToken,(req,res,next)=>{
    const id = req.params.id;
    var query = "delete from club where id=?";
    connection.query(query,[id],(err,results)=>{
        if(!err){
            if(results.affectedRows == 0){
                return res.status(404).json({message:"Id Club no encontrado"});
            }
            return res.status(200).json({message:"Club eliminado con éxito"});
        }
        else{
            return res.status(500).json(err);
        }
    })
})

module.exports = router;