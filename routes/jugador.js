const express = require('express');
const connection = require('../connection');
const router = express.Router();
var auth = require('../services/authentication');
var checkRole = require('../services/checkRole');

const multer = require('../libs/multer');
const fs = require('fs');


//------------LISTAR JUGADOR------------------------------------------------------------------------
router.get('/get', auth.authenticateToken, (req, res, next) => {
    var query = "select j.ci,j.nombre,j.ap_paterno,j.ap_materno,j.fecha_nacimiento,j.sexo,j.decendencia,j.fecha_habilitacion,j.foto,j.status,j.documento, TIMESTAMPDIFF(YEAR,fecha_nacimiento,CURDATE()) AS edad,c.id as clubId,DATE_FORMAT(j.fecha_nacimiento, '%d-%m-%Y') as fecha_nac,c.nombre as NombreClub from jugador as j INNER JOIN club as c where j.clubId = c.id";
    connection.query(query, (err, results) => {
        if (!err) {
            return res.status(200).json(results);
        }
        else {
            return res.status(500).json(err);
        }
    })
});

//------------REGISTRAR JUGADOR ------------------------------------------------------------------------
router.post('/add', multer.single('foto'), auth.authenticateToken, checkRole.checkRole, (req, res, next) => {
    const file = req.file;
    let jugador = req.body;
    let datos = {};
    let fecha = new Date(jugador.fecha_nacimiento); //convierte a tipo fecha

    if (!file) {
        datos = {
            ci: jugador.ci,
            nombre: jugador.nombre,
            ap_paterno: jugador.ap_paterno,
            ap_materno: jugador.ap_materno,
            fecha_nacimiento: fecha.toISOString(), //convierte a tipo fecha segun la ISO
            sexo: jugador.sexo,
            decendencia: jugador.decendencia,
            clubId: jugador.clubId,
            fecha_habilitacion: new Date(),
            foto: '',
            status: 'true'
        }
    } else {
        datos = {
            ci: jugador.ci,
            nombre: jugador.nombre,
            ap_paterno: jugador.ap_paterno,
            ap_materno: jugador.ap_materno,
            fecha_nacimiento: fecha.toISOString(),
            sexo: jugador.sexo,
            decendencia: jugador.decendencia,
            clubId: jugador.clubId,
            fecha_habilitacion: new Date(),
            foto: req.file.filename,
            status: 'true'
        }
    }
    //console.log(datos);
    connection.query('insert into jugador set ?', [datos], (err, results) => {
        if (!err) {
            return res.status(200).json({ message: "Jugador agregado con exito" });
        }
        else {
            return res.status(500).json(err);
        }
    });
    console.log('Agregado Correctamente');
    /*
    let jugador = req.body;
    query = "insert into jugador (ci,nombre,ap_paterno,ap_materno,fecha_nacimiento,sexo,decendencia,clubId,fecha_habilitacion,foto,status) values(?,?,?,?,?,?,?,?,?,?,'true')";
    connection.query(query,[jugador.ci,jugador.nombre,jugador.ap_paterno,jugador.ap_materno,jugador.fecha_nacimiento,jugador.sexo,jugador.decendencia,jugador.clubId,jugador.fecha_habilitacion,jugador.foto],(err,results)=>{
        if(!err){
            return res.status(200).json({message:"Jugador agregado con exito"});
        }
        else{
            return res.status(500).json(err);
        }
    })*/
})


//------------------------ OBTENER JUGADORES SEGUN ID CLUB ---------------------------------------------------
router.get('/getByClub/:id', auth.authenticateToken, (req, res, next) => {
    const id = req.params.id;
    var query = "select ci,nombre,ap_paterno,ap_materno, fecha_nacimiento"
        + " from jugador where clubId=? and status='true'";
    connection.query(query, [id], (err, results) => {
        if (!err) {
            return res.status(200).json(results);
        }
        else {
            return res.status(500).json(err);
        }
    })
})

//------------------------ OBTENER JUGADOR SEGUN SEXO, CLUB, Y RAGO DE EDADES --------------------------------
router.get('/getJugadoresByEdad/:id_club/:sexo/:edad_min/:edad_max', auth.authenticateToken, (req, res, next) => {
    const id_club = req.params.id_club;
    const sexo = req.params.sexo;
    const edad_min = req.params.edad_min;
    const edad_max = req.params.edad_max;
    if (sexo === 'Masculino' || sexo === 'Femenino') {
        var query = "SELECT *, TIMESTAMPDIFF(YEAR, fecha_nacimiento, CURDATE()) AS edad"
            + " FROM jugador  where sexo = ? AND clubId = ? AND  TIMESTAMPDIFF(YEAR, fecha_nacimiento, CURDATE()) BETWEEN ? AND ?";
        connection.query(query, [sexo, id_club, edad_min, edad_max], (err, results) => {
            if (!err) {
                return res.status(200).json(results);
            }
            else {
                return res.status(500).json(err);
            }
        })
    } else {
        var query = "SELECT *, TIMESTAMPDIFF(YEAR, fecha_nacimiento, CURDATE()) AS edad"
            + " FROM jugador  where  clubId = ? AND  TIMESTAMPDIFF(YEAR, fecha_nacimiento, CURDATE()) BETWEEN ? AND ?";
        connection.query(query, [id_club, edad_min, edad_max], (err, results) => {
            if (!err) {
                return res.status(200).json(results);
            }
            else {
                return res.status(500).json(err);
            }
        })
    }
})



//------------------------ MODIFICAR JUGADOR---------------------------------------------------
router.patch('/update', multer.single('foto'), auth.authenticateToken, checkRole.checkRole, (req, res, next) => {
    const file = req.file;
    let jugador = req.body;
    let datos = {};
    let fecha = new Date(jugador.fecha_nacimiento);

    if (!file) {
        datos = {
            ci: jugador.ci,
            nombre: jugador.nombre,
            ap_paterno: jugador.ap_paterno,
            ap_materno: jugador.ap_materno,
            fecha_nacimiento: fecha.toISOString(), //convierte a tipo fecha segun la ISO
            sexo: jugador.sexo,
            decendencia: jugador.decendencia,
            clubId: jugador.clubId,
            fecha_habilitacion: new Date(),
            foto: jugador.nombreimg,
            status: 'true'
        }
    } else {
        datos = {
            ci: jugador.ci,
            nombre: jugador.nombre,
            ap_paterno: jugador.ap_paterno,
            ap_materno: jugador.ap_materno,
            fecha_nacimiento: fecha.toISOString(),
            sexo: jugador.sexo,
            decendencia: jugador.decendencia,
            clubId: jugador.clubId,
            fecha_habilitacion: new Date(),
            foto: req.file.filename,
            status: 'true'
        }
    }
    var query = "update jugador set ci=?,nombre=?,ap_paterno=?,ap_materno=?,fecha_nacimiento=?,sexo=?,decendencia=?,clubId=?,foto=? where ci=?";
    connection.query(query, [datos.ci, datos.nombre, datos.ap_paterno, datos.ap_materno, datos.fecha_nacimiento, datos.sexo, datos.decendencia, datos.clubId, datos.foto, datos.ci], (err, results) => {
        if (!err) {
            if (results.affectedRows == 0) {
                return res.status(404).json({ message: "Jugador CI no encontrado" });
            }
            return res.status(200).json({ message: "Jugador Actualizado con exito" });
        }
        else {
            return res.status(500).json(err);
        }
    })
    /*
       let jugador = req.body;
       var query = "update jugador set ci=?,nombre=?,ap_paterno=?,ap_materno=?,fecha_nacimiento=?,sexo=?,decendencia=?,clubId=?,foto=? where ci=?";
       connection.query(query, [jugador.ci, jugador.nombre, jugador.ap_paterno, jugador.ap_materno, jugador.fecha_nacimiento, jugador.sexo, jugador.decendencia, jugador.clubId, jugador.foto, jugador.ci], (err, results) => {
           if (!err) {
               if (results.affectedRows == 0) {
                   return res.status(404).json({ message: "Jugador CI no encontrado" });
               }
               return res.status(200).json({ message: "Jugador Actualizado2 con exito" });
           }
           else {
               return res.status(500).json(err);
           }
       })*/
})

//------------------------ MODIFICAR JUGADOR---------------------------------------------------
router.patch('/subir_documento', multer.single('documento'), auth.authenticateToken, checkRole.checkRole, (req, res, next) => {
    const file = req.file;
    let jugador = req.body;
    let datos = {};
    let fecha = new Date(jugador.fecha_nacimiento);

    if (!file) {
        datos = {
            ci: jugador.ci,
            documento: '',
            status: 'true'
        }
    } else {
        datos = {
            ci: jugador.ci,
            documento: req.file.filename,
            status: 'true'
        }
    }
    var query = "update jugador set documento=? where ci=?";
    connection.query(query, [datos.documento, datos.ci], (err, results) => {
        if (!err) {
            if (results.affectedRows == 0) {
                return res.status(404).json({ message: "Jugador CI no encontrado" });
            }
            return res.status(200).json({ message: "Documentos Jugador subido  con exito" });
        }
        else {
            return res.status(500).json(err);
        }
    })
  
})



//------------------------ OBTENER JUGADOR SEGUN CI --------------------------------------------------- 
router.get('/getById/:ci', auth.authenticateToken, (req, res, next) => {
    const ci = req.params.ci;
    var query = "select ci,nombre,ap_paterno,ap_materno, fecha_nacimiento,foto from jugador where ci=?";
    connection.query(query, [ci], (err, results) => {
        if (!err) {
            return res.status(200).json(results[0]);
        }
        else {
            return res.status(500).json(err);
        }
    })
})

//------------------------ ELIMINAR JUGADOR---------------------------------------------------
router.delete('/delete/:ci', auth.authenticateToken, checkRole.checkRole, (req, res, next) => {
    const ci = req.params.ci;
    deleteFile(ci);
    var query = "delete from jugador where ci=?";
    connection.query(query, [ci], (err, results) => {
        if (!err) {
            if (results.affectedRows == 0) {
                return res.status(404).json({ message: "Jugador CI no encontrado" });
            }
            return res.status(200).json({ message: "Jugador eliminado con exito" });
        }
        else {
            return res.status(500).json(err);
        }
    })
})

function deleteFile(ci) {
    connection.query('SELECT * FROM  jugador WHERE ci = ?', [ci], (err, rows, fields) => {
        [{ foto }] = rows;
        console.log("Foto: " + foto);
        if (foto === '') {
            console.log('jugador eliminado');
        } else {
            fs.unlinkSync('./uploads/img/' + foto);
        }
    });
}


//------------------------ ACTUALIZAR JUGADOR DESPUES DE ELIMINAR---------------------------------------------------
router.patch('/updateStatus', auth.authenticateToken, checkRole.checkRole, (req, res, next) => {
    let jugador = req.body;
    var query = "update jugador set status=? where ci=?";
    connection.query(query, [jugador.status, jugador.ci], (err, results) => {
        if (!err) {
            if (results.affectedRows == 0) {
                return res.status(404).json({ message: "Jugador CI no encontrado" });
            }
            return res.status(200).json({ message: "Estado Jugador actualizado con exito" });
        }
        else {
            return res.status(500).json(err);
        }
    })
})

module.exports = router;