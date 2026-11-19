const express = require("express");
const connection = require('../connection');
const { errorBD } = require('../libs/errores');
const router = express.Router();

//-------------------------------- MOSTRAR/LISTAR -----------------------
router.get("/get_all", (req, res) => {
    connection.query('SELECT * FROM auspiciador', (err, results) => {
        if (!err) {
            return res.status(200).json(results);
        }
        else {
            return errorBD(res, err);
        }
    });
});

//-------------------------------- MOSTRAR/LISTAR SOLO LOS HABILITADOS-----------------------
router.get("/get", (req, res) => {
    connection.query("SELECT * FROM auspiciador WHERE estado='true'", (err, results) => {
        if (!err) {
            return res.status(200).json(results);
        }
        else {
            return errorBD(res, err);
        }
    });
}); 

//-------------------------------- AGREGAR --------------------------------
router.post('/add', (req, res, next) => {
    let auspiciador = req.body;
    let datos = {};

    datos = {
        nit: auspiciador.nit,
        ci: auspiciador.ci,
        nombre: auspiciador.nombre,
        ap_paterno: auspiciador.ap_paterno,
        ap_materno: auspiciador.ap_materno,
        sitio: auspiciador.sitio,
        telefono: auspiciador.telefono,
        estado: 'true'
    }
    //console.log(datos);
    connection.query('insert into auspiciador set ?', [datos], (err, results) => {
        if (!err) {
            return res.status(200).json({ message: "Auspiciador agregado con exito" });
        }
        else {
            return errorBD(res, err);
        }
    });
});


//------------------------ MODIFICAR ---------------------------------------------------
router.patch('/update', (req, res, next) => {
    let auspiciador = req.body;
    let datos = {};

    datos = {
        id_ausp: auspiciador.id_ausp,
        nit: auspiciador.nit,
        ci: auspiciador.ci,
        nombre: auspiciador.nombre,
        ap_paterno: auspiciador.ap_paterno,
        ap_materno: auspiciador.ap_materno,
        sitio: auspiciador.sitio,
        telefono: auspiciador.t
    }

    var query = "update auspiciador set nit=?,ci=?,nombre=?,ap_paterno=?,ap_materno=?,sitio=?, telefono=? where id_ausp=?";
    connection.query(query, [datos.nit,datos.ci,datos.nombre,datos.ap_paterno,datos.ap_materno,datos.sitio,datos.telefono, datos.id_ausp], (err, results) => {
        if (!err) {
            if (results.affectedRows == 0) {
                return res.status(404).json({ message: "Id auspiciador no encontrado" });
            }
            return res.status(200).json({ message: "Auspiciador Actualizado con exito" });
        }
        else {
            return errorBD(res, err);
        }
    })
})

//-----------------------------------------------------------------------------------------------------------

//------------ ELIMINAR---------------------------------------------------------------------------

router.delete('/delete/:id_ausp', (req, res, next) => {
    const id_ausp = req.params.id_ausp;
    var query = "delete from auspiciador where id_ausp=?";
    connection.query(query, [id_ausp], (err, results) => {
        if (!err) {
            if (results.affectedRows == 0) {
                return res.status(404).json({ message: "Id Auspiciador no encontrado" });
            }
            return res.status(200).json({ message: "Auspiciador eliminado con éxito" });
        }
        else {
            return errorBD(res, err);
        }
    })
})

//-------------------------------------------------------------------------------------------------

//------------------ CAMBIAR ESTADO ----------------------------------------------------------------
router.patch('/updateStatus', (req, res, next) => {
    let auspiciador = req.body;
    var query = "update auspiciador set estado=? where id_ausp=?";
    connection.query(query, [auspiciador.estado, auspiciador.id_ausp], (err, results) => {
        if (!err) {
            if (results.affectedRows == 0) {
                return res.status(404).json({ message: "Id Auspiciador no encontrado" });
            }
            return res.status(200).json({ message: "Estado Auspiciador actualizado con éxito" });
        }
        else {
            return errorBD(res, err);
        }
    })
})

//------------------------ OBTENER  SEGUN ID ---------------------------------------------------
router.get('/getById/:id', (req, res, next) => {
    const id = req.params.id;
    var query = "select * from auspiciador where id_ausp=?";
    connection.query(query, [id], (err, results) => {
        if (!err) {
            return res.status(200).json(results[0]);
        }
        else {
            return errorBD(res, err);
        }
    })
})

module.exports = router;