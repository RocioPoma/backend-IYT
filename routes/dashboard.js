const express = require('express');
const connection =require('../connection');
const router = express.Router();
var auth = require('../services/authentication');


router.get('/details',auth.authenticateToken,(req,res,next)=>{
    var clubCount;
    var jugadorCount;
    var billCount;
    var userCount;

    var query = "select count(id) as userCount from user";
    connection.query(query,(err,results)=>{
        if(!err){
            userCount = results[0].userCount;
        }
        else{
            return res.status(500).json(err);
        }
    })

    var query = "select count(id) as clubCount from club";
    connection.query(query,(err,results)=>{
        if(!err){
            clubCount = results[0].clubCount;
        }
        else{
            return res.status(500).json(err);
        }
    })

    var query = "select count(ci) as jugadorCount from jugador ";
    connection.query(query,(err,results)=>{
        if(!err){
            jugadorCount = results[0].jugadorCount;
        }
        else{
            return res.status(500).json(err);
        }
    }) 

    var query = "select count(id) as billCount from bill";
    connection.query(query,(err,results)=>{
        if(!err){
            billCount = results[0].billCount;
            var data = {
                club:clubCount,
                jugador:jugadorCount,
                bill:billCount
            };
            return res.status(200).json(data);
        }
        else{
            return res.status(500).json(err);
        }
    })


})



module.exports = router;