const express = require('express');
const connection =require('../connection');
const { errorBD } = require('../libs/errores');
const router = express.Router();

//----------para archivos-----------------------------------------------------------------------------
const multer = require('../libs/multer');
const { eliminarConArchivos, reemplazarArchivo } = require('../libs/archivos');
//-----------------------------------------------------------------------------------------------------

// Número del campeonato en romanos y en mayúsculas (I, II, ... XX, XXI ...)
const ROMANO = /^(?=[MDCLXVI])M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;

/** Valida y normaliza los datos del anfitrión. Devuelve un mensaje de error o null. */
function datosAnfitrion(b) {
    const numero = String(b.numero_romano || '').trim().toUpperCase();
    if (numero && !ROMANO.test(numero)) return { error: 'El número de campeonato debe estar en números romanos (por ejemplo: XX, XXI)' };
    const club = b.id_club_anfitrion === '' || b.id_club_anfitrion === 'null' || b.id_club_anfitrion == null ? null : Number(b.id_club_anfitrion);
    if (club !== null && !Number.isInteger(club)) return { error: 'Club anfitrión inválido' };
    return {
        numero_romano: numero || null,
        comunidad_anfitriona: String(b.comunidad_anfitriona || '').trim() || null,
        id_club_anfitrion: club,
    };
}

const CAMPOS_ANFITRION = `c.numero_romano, c.comunidad_anfitriona, c.id_club_anfitrion,
    ca.nombre AS club_anfitrion, ca.logo AS logo_club_anfitrion`;

//------------LISTAR CAMPEONATO------------------------------------------------------------------------
router.get('/get',(req,res,next)=>{
    var query = "SELECT c.id,c.nombre_campeonato, c.fecha_inicio,c.fecha_fin, DATE_FORMAT(c.fecha_inicio, '%d-%m-%Y') as fecha_i,DATE_FORMAT(c.fecha_fin, '%d-%m-%Y') as fecha_f, c.convocatoria,c.gestion, c.status, " + CAMPOS_ANFITRION
    +" FROM campeonato c LEFT JOIN club ca ON ca.id = c.id_club_anfitrion order by c.gestion DESC";
    connection.query(query,(err,results)=>{
        if(!err){
            return res.status(200).json(results);
        }
        else{
            return errorBD(res, err);
        }
    })
})

//------------AGREGAR CAMPEONATO------------------------------------------------------------------------
router.post('/add', multer.single('convocatoria'), (req, res, next) => {
    const file = req.file;
    let campeonato = req.body;
    let datos = {};
    let fecha_i= new Date(campeonato.fecha_inicio); //convierte a tipo fecha
    let fecha_f= new Date(campeonato.fecha_fin); //convierte a tipo fecha
    const anfitrion = datosAnfitrion(campeonato);
    if (anfitrion.error) return res.status(400).json({ message: anfitrion.error });

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
    Object.assign(datos, anfitrion);
    connection.query('insert into campeonato set ?', [datos], (err, results) => {
        if (!err) {
            return res.status(200).json({ message: "Campeonato agregado con exito"});
        }
        else {
            return errorBD(res, err);
        }
    });
})
/*router.post('/add',(req,res)=>{
    let campeonato = req.body;
    query = "insert into campeonato (nombre_campeonato,fecha_inicio,fecha_fin,convocatoria,gestion,status) values(?,?,?,?,?,'true')";
    connection.query(query,[campeonato.nombre_campeonato,campeonato.fecha_inicio,campeonato.fecha_fin,campeonato.convocatoria,campeonato.gestion],(err,results)=>{
        if(!err){
            return res.status(200).json({message:"Campeonato agregado con exito"});
        }
        else{
            return errorBD(res, err);
        }
    })
})*/


//------------------------ MODIFICAR CAMPEONATO---------------------------------------------------
router.patch('/update',multer.single('convocatoria'), (req, res, next) => {
    const file = req.file;
    let campeonato = req.body;
    let datos = {};
    let fecha_i= new Date(campeonato.fecha_inicio); //convierte a tipo fecha
    let fecha_f= new Date(campeonato.fecha_fin); //convierte a tipo fecha
    const anfitrion = datosAnfitrion(campeonato);
    if (anfitrion.error) return res.status(400).json({ message: anfitrion.error });

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
    var query = "update campeonato set nombre_campeonato=?,fecha_inicio=?,fecha_fin=?,convocatoria=?,gestion=?,numero_romano=?,comunidad_anfitriona=?,id_club_anfitrion=? where id=?";
    connection.query(query, [datos.nombre_campeonato, datos.fecha_inicio, datos.fecha_fin, datos.convocatoria, datos.gestion,
        anfitrion.numero_romano, anfitrion.comunidad_anfitriona, anfitrion.id_club_anfitrion, datos.id], (err, results) => {
        if (!err) {
            if (results.affectedRows == 0) {
                return res.status(404).json({ message: "Id Campeonato no encontrado" });
            }
            if (file) reemplazarArchivo(campeonato.nombre_conv, datos.convocatoria);
            return res.status(200).json({ message: "Campeonato Actualizado con exito" });
        }
        else {
            return errorBD(res, err);
        }
    })
})
/*router.patch('/update',(req,res,next)=>{
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
            return errorBD(res, err);
        }
    })
})*/

//-----------------------------------------------------------------------------------------------------------

//------------ ELIMINAR CAMPEONATO---------------------------------------------------------------------------
router.delete('/delete/:id', async (req, res, next) => {
    try {
        const r = await eliminarConArchivos('campeonato', 'id', req.params.id, ['convocatoria']);
        if (r.affectedRows == 0) {
            return res.status(404).json({ message: "Campeonato Id no encontrado" });
        }
        return res.status(200).json({ message: "Campeonato eliminado con éxito" });
    } catch (err) {
        next(err);
    }
});
//------------------------------------------------------------------------------------------------



//------------------  CAMBIAR ESTADO CAMPEONATO ---------------------------------------------------
router.patch('/updateStatus',(req,res,next)=>{
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
            return errorBD(res, err);
        }
    })
})

//------------------------ OBTENER CAMPEONATO SEGUN ID ---------------------------------------------------
router.get('/getByIdc/:id', (req, res, next) => {
    const id = req.params.id;
    var query = "select c.*, DATE_FORMAT(c.fecha_inicio, '%d-%m-%Y') as fecha_i,DATE_FORMAT(c.fecha_fin, '%d-%m-%Y') as fecha_f, ca.nombre AS club_anfitrion, ca.logo AS logo_club_anfitrion from campeonato c LEFT JOIN club ca ON ca.id = c.id_club_anfitrion where c.id=?";
    connection.query(query, [id], (err, results) => {
        if (!err) {
            return res.status(200).json(results[0]);
        }
        else {
            return errorBD(res, err);
        }
    })
})
//-------------------------------todavia no se utilizo ----------------------------------------------
router.get('/getById/:id',(req,res,next)=>{
    const id = req.params.id;
    var query = "select c.id,c.nombre_campeonato,c.fecha_inicio,c.fecha_fin,c.convocatoria,c.gestion,c.status, " + CAMPOS_ANFITRION + " from campeonato c LEFT JOIN club ca ON ca.id = c.id_club_anfitrion where c.id=?";
    connection.query(query,[id],(err,results)=>{
        if(!err){
            return res.status(200).json(results[0]);
        }
        else{
            return errorBD(res, err);
        }
    })
})

module.exports = router;