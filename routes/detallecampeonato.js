const express = require('express');
const connection =require('../connection');
const { errorBD } = require('../libs/errores');
const router = express.Router();

//----------para archivos----------
const multer = require('../libs/multer');


//------------LISTAR CAMPEONATO------------------------------------------------------------------------
router.get('/get',(req,res,next)=>{
    var query = "SELECT id,nombre_campeonato, fecha_inicio,fecha_fin, DATE_FORMAT(fecha_inicio, '%d-%m-%Y') as fecha_i,DATE_FORMAT(fecha_fin, '%d-%m-%Y') as fecha_f, convocatoria,gestion, status  FROM campeonato";
    connection.query(query,(err,results)=>{
        if(!err){
            return res.status(200).json(results);
        }
        else{
            return errorBD(res, err);
        }
    })
})

module.exports = router;