const express = require('express');
const connection =require('../connection');
const router = express.Router();
var auth = require('../services/authentication');
var checkRole = require('../services/checkRole');

//----------para archivos----------
const multer = require('../libs/multer');
const fs = require('fs');


//------------LISTAR CAMPEONATO------------------------------------------------------------------------
router.get('/get',auth.authenticateToken,(req,res,next)=>{
    console.log("LLEGO AQUI")
    var query = "SELECT id,nombre_campeonato, fecha_inicio,fecha_fin, DATE_FORMAT(fecha_inicio, '%d-%m-%Y') as fecha_i,DATE_FORMAT(fecha_fin, '%d-%m-%Y') as fecha_f, convocatoria,gestion, status  FROM campeonato";
    connection.query(query,(err,results)=>{
        if(!err){
            return res.status(200).json(results);
        }
        else{
            return res.status(500).json(err);
        }
    })
})

module.exports = router;