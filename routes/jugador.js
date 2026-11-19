const express = require('express');
const connection = require('../connection');
const { errorBD } = require('../libs/errores');
const router = express.Router();
const { soloSuClub } = require('../services/club');

const multer = require('../libs/multer');
const { eliminarConArchivos, reemplazarArchivo } = require('../libs/archivos');
const storage = require('../services/storage');


//------------LISTAR JUGADOR------------------------------------------------------------------------
router.get('/get', (req, res, next) => {
    var query = "select j.ci,j.nombre,j.ap_paterno,j.ap_materno,j.fecha_nacimiento,j.sexo,j.decendencia,j.fecha_habilitacion,j.foto,j.status,j.documento, TIMESTAMPDIFF(YEAR,fecha_nacimiento,CURDATE()) AS edad,c.id as clubId,DATE_FORMAT(j.fecha_nacimiento, '%d-%m-%Y') as fecha_nac,c.nombre as NombreClub, c.comunidad as ComunidadClub from jugador as j INNER JOIN club as c where j.clubId = c.id";
    const params = [];
    // El delegado solo ve la lista oficial de jugadores de su club
    if (req.usuario && req.usuario.role === 'delegado') {
        query += " and c.id = ?";
        params.push(req.usuario.id_club || 0);
    }
    query += " order by c.nombre, j.ap_paterno, j.nombre";
    connection.query(query, params, (err, results) => {
        if (!err) {
            return res.status(200).json(results);
        }
        else {
            return errorBD(res, err);
        }
    })
});

//------------REGISTRAR JUGADOR ------------------------------------------------------------------------
router.post('/add', multer.single('foto'), (req, res, next) => {
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
            fecha_nacimiento: fecha, //convierte a tipo fecha segun la ISO
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
            fecha_nacimiento: fecha,
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
            return errorBD(res, err);
        }
    });
    /*
    let jugador = req.body;
    query = "insert into jugador (ci,nombre,ap_paterno,ap_materno,fecha_nacimiento,sexo,decendencia,clubId,fecha_habilitacion,foto,status) values(?,?,?,?,?,?,?,?,?,?,'true')";
    connection.query(query,[jugador.ci,jugador.nombre,jugador.ap_paterno,jugador.ap_materno,jugador.fecha_nacimiento,jugador.sexo,jugador.decendencia,jugador.clubId,jugador.fecha_habilitacion,jugador.foto],(err,results)=>{
        if(!err){
            return res.status(200).json({message:"Jugador agregado con exito"});
        }
        else{
            return errorBD(res, err);
        }
    })*/
})


//------------------------ OBTENER JUGADORES SEGUN ID CLUB ---------------------------------------------------
router.get('/getByClub/:id', soloSuClub((req) => req.params.id), (req, res, next) => {
    const id = req.params.id;
    var query = "select ci,nombre,ap_paterno,ap_materno, fecha_nacimiento"
        + " from jugador where clubId=? and status='true' order by nombre asc";
    connection.query(query, [id], (err, results) => {
        if (!err) {
            return res.status(200).json(results);
        }
        else {
            return errorBD(res, err);
        }
    })
})

//------------------------ OBTENER JUGADOR SEGUN SEXO, CLUB, Y RAGO DE EDADES --------------------------------
router.get('/getJugadoresByEdad/:id_club/:sexo/:edad_min/:edad_max', soloSuClub((req) => req.params.id_club), (req, res, next) => {
    const id_club = req.params.id_club;
    const sexo = req.params.sexo;
    const edad_min = req.params.edad_min;
    const edad_max = req.params.edad_max;
    if (sexo === 'Masculino' || sexo === 'Femenino') {
        var query = "SELECT *,DATE_FORMAT(jugador.fecha_nacimiento, '%d-%m-%Y') as fecha_nac, TIMESTAMPDIFF(YEAR, fecha_nacimiento, CURDATE()) AS edad"
            + " FROM jugador  where sexo = ? AND clubId = ? AND  TIMESTAMPDIFF(YEAR, fecha_nacimiento, CURDATE()) BETWEEN ? AND ? order by nombre";
        connection.query(query, [sexo, id_club, edad_min, edad_max], (err, results) => {
            if (!err) {
                return res.status(200).json(results);
            }
            else {
                return errorBD(res, err);
            }
        })
    } else {
        var query = "SELECT *, DATE_FORMAT(jugador.fecha_nacimiento, '%d-%m-%Y') as fecha_nac,TIMESTAMPDIFF(YEAR, fecha_nacimiento, CURDATE()) AS edad"
            + " FROM jugador  where  clubId = ? AND  TIMESTAMPDIFF(YEAR, fecha_nacimiento, CURDATE()) BETWEEN ? AND ? order by nombre";
        connection.query(query, [id_club, edad_min, edad_max], (err, results) => {
            if (!err) {
                return res.status(200).json(results);
            }
            else {
                return errorBD(res, err);
            }
        })
    }
})



//------------------------ MODIFICAR JUGADOR---------------------------------------------------
router.patch('/update', multer.single('foto'), (req, res, next) => {
    const file = req.file;
    let jugador = req.body;
    let datos = {};
    let fecha = new Date(jugador.fecha_nacimiento);

    if (!file) {
        datos = {
            ci: jugador.ci_mod,
            nombre: jugador.nombre,
            ap_paterno: jugador.ap_paterno,
            ap_materno: jugador.ap_materno,
            fecha_nacimiento: fecha, //convierte a tipo fecha segun la ISO
            sexo: jugador.sexo,
            decendencia: jugador.decendencia,
            clubId: jugador.clubId,
            fecha_habilitacion: new Date(),
            foto: jugador.nombreimg,
            status: 'true'
        }
    } else {
        datos = {
            ci: jugador.ci_mod,
            nombre: jugador.nombre,
            ap_paterno: jugador.ap_paterno,
            ap_materno: jugador.ap_materno,
            fecha_nacimiento: fecha,
            sexo: jugador.sexo,
            decendencia: jugador.decendencia,
            clubId: jugador.clubId,
            fecha_habilitacion: new Date(),
            foto: req.file.filename,
            status: 'true'
        }
    }

    var query = "update jugador set ci=?,nombre=?,ap_paterno=?,ap_materno=?,fecha_nacimiento=?,sexo=?,decendencia=?,clubId=?,foto=? where ci=?";
    connection.query(query, [datos.ci, datos.nombre, datos.ap_paterno, datos.ap_materno, datos.fecha_nacimiento, datos.sexo, datos.decendencia, datos.clubId, datos.foto, jugador.ci], (err, results) => {
        if (!err) {
            if (results.affectedRows == 0) {
                return res.status(404).json({ message: "Jugador CI no encontrado" });
            }
            if (file) reemplazarArchivo(jugador.nombreimg, datos.foto);
            return res.status(200).json({ message: "Jugador Actualizado con exito" });
        }
        else {
            return errorBD(res, err);
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
               return errorBD(res, err);
           }
       })*/
})

//------------------------ CAMBIAR SOLO LA FOTO (clic en la foto de la lista) -----------------------
router.patch('/foto/:ci', multer.single('foto'), async (req, res, next) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'Seleccione una imagen' });
        if (!/^image\//.test(req.file.mimetype || '')) {
            await storage.eliminarSeguro(req.file.filename);
            return res.status(400).json({ message: 'La foto debe ser una imagen (JPG, PNG o WEBP)' });
        }
        const actual = await connection.consulta('SELECT foto FROM jugador WHERE ci=?', [req.params.ci]);
        if (!actual.length) {
            await storage.eliminarSeguro(req.file.filename);
            return res.status(404).json({ message: 'Jugador CI no encontrado' });
        }
        await connection.consulta('UPDATE jugador SET foto=? WHERE ci=?', [req.file.filename, req.params.ci]);
        await reemplazarArchivo(actual[0].foto, req.file.filename);
        return res.status(200).json({ message: 'Foto actualizada con éxito', foto: req.file.filename });
    } catch (e) { next(e); }
});

//------------------------ MODIFICAR JUGADOR---------------------------------------------------
router.patch('/subir_documento', multer.single('documento'), (req, res, next) => {
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
            return errorBD(res, err);
        }
    })

})



//------------------------ OBTENER JUGADOR SEGUN CI --------------------------------------------------- 
router.get('/getById/:ci', (req, res, next) => {
    const ci = req.params.ci;
    var query = "select ci,nombre,ap_paterno,ap_materno, fecha_nacimiento,foto,clubId from jugador where ci=?";
    connection.query(query, [ci], (err, results) => {
        if (!err) {
            const j = results[0];
            if (j && req.usuario && req.usuario.role === 'delegado' && String(j.clubId) !== String(req.usuario.id_club)) {
                return res.status(403).json({ message: "Solo puede ver los jugadores de su club" });
            }
            return res.status(200).json(j);
        }
        else {
            return errorBD(res, err);
        }
    })
})

//------------------------ ELIMINAR JUGADOR---------------------------------------------------
router.delete('/delete/:ci', async (req, res, next) => {
    try {
        const r = await eliminarConArchivos('jugador', 'ci', req.params.ci, ['foto','documento']);
        if (r.affectedRows == 0) {
            return res.status(404).json({ message: "Jugador CI no encontrado" });
        }
        return res.status(200).json({ message: "Jugador eliminado con exito" });
    } catch (err) {
        next(err);
    }
});


//------------------------ ACTUALIZAR JUGADOR DESPUES DE ELIMINAR---------------------------------------------------
router.patch('/updateStatus', (req, res, next) => {
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
            return errorBD(res, err);
        }
    })
})

module.exports = router;