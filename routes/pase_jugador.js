const express = require("express");
const connection = require('../connection');
const router = express.Router();
var auth = require('../services/authentication');
var checkRole = require('../services/checkRole');
const multer = require('../libs/multer');
const fs = require('fs');

//-------------------------------- MOSTRAR/LISTAR REGLAMENTO -----------------------
router.get("/get", auth.authenticateToken, (req, res) => {
    connection.query("select pj.*, c1.nombre as club_solicitante,c2.nombre as club_solicitado,j.ci,j.nombre,j.ap_paterno,j.ap_materno, DATE_FORMAT(pj.fecha, '%d-%m-%Y') as fecha2 "
        + " from pase_jugador pj, club c1,club c2,jugador j"
        + " where pj.id_club_solicitante=c1.id and id_club_solicitado=c2.id and pj.ci=j.ci;", (err, results) => {
            if (!err) {
                return res.status(200).json(results);
            }
            else {
                return res.status(500).json(err);
            }
        });
});

//-------------------------------- AGREGAR PASE JUGADOR--------------------------------
/*router.post('/add', multer.single('documento'), auth.authenticateToken, (req, res, next) => {
    const file = req.file;
    let pase = req.body;
    let datos = {};
    let fecha = new Date(pase.fecha); //convierte a tipo fecha

    datos = {
        id_club_solicitante: pase.id_club_solicitante,
        id_club_solicitado: pase.id_club_solicitado,
        ci: pase.ci,
        fecha: fecha, //convierte a tipo fecha segun la ISO
        documento: req.file.filename,
        estado: 'true'
    }

    //console.log(datos);
    connection.query('insert into pase_jugador set ?', [datos], (err, results) => {
        if (!err) {
            return res.status(200).json({ message: "Pase Jugador agregado con exito" });

        }
        else {
            console.error(err.message);
            return res.status(500).json(err);
        }
    });

    var query = "update jugador set clubId=? where ci=?";
    connection.query(query, [pase.id_club_solicitante, pase.ci], (err, results) => {
        if (!err) {
            if (results.affectedRows == 0) {
                return res.status(404).json({ message: "Jugador CI no encontrado" });
            }
            return res.status(200).json({ message: "Club ID actualizado con éxito" });
        } else {
            return res.status(500).json(err);
        }
    });
 


    console.log('Agregado Correctamente');
});*/

router.post('/add', multer.single('documento'), auth.authenticateToken, (req, res, next) => {
    const file = req.file;
    let pase = req.body;
    let datos = {};
    let fecha = new Date(pase.fecha); // Convierte la fecha a tipo Date

    datos = {
        id_club_solicitante: pase.id_club_solicitante,
        id_club_solicitado: pase.id_club_solicitado,
        ci: pase.ci,
        fecha: fecha, // Convierte a tipo fecha ISO
        documento: req.file.filename,
        estado: 'true'
    };

    // Inserción en la tabla pase_jugador
    connection.query('INSERT INTO pase_jugador SET ?', [datos], (err, results) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ message: "Error al agregar pase jugador", error: err.message });
        }

        // Si la inserción fue exitosa, actualizar el club del jugador
        const queryUpdate = "UPDATE jugador SET clubId=? WHERE ci=?";
        connection.query(queryUpdate, [pase.id_club_solicitante, pase.ci], (errUpdate, resultsUpdate) => {
            if (errUpdate) {
                console.error(errUpdate.message);
                return res.status(500).json({ message: "Error al actualizar jugador", error: errUpdate.message });
            }

            if (resultsUpdate.affectedRows === 0) {
                return res.status(404).json({ message: "Jugador CI no encontrado" });
            }

            // Respuesta exitosa
            return res.status(200).json({ message: "Pase Jugador agregado y Club ID actualizado con éxito" });
        });
    });
    
    console.log('Agregado Correctamente');
});




//------------------------ MODIFICAR REGLAMENTO---------------------------------------------------
router.patch('/update', multer.single('documento'), auth.authenticateToken, (req, res, next) => {
    const file = req.file;
    let pase = req.body;
    let datos = {};
    let fecha = new Date(pase.fecha); //convierte a tipo fecha
    if (!file) {
        datos = {
            id_pase: pase.id_pase,
            id_club_solicitante: pase.id_club_solicitante,
            id_club_solicitado: pase.id_club_solicitado,
            ci: pase.ci,
            fecha: fecha, //convierte a tipo fecha segun la ISO
            documento: req.file.filename,
            estado: 'true'
        }
    } else {
        datos = {
            id_pase: pase.id_pase,
            id_club_solicitante: pase.id_club_solicitante,
            id_club_solicitado: pase.id_club_solicitado,
            ci: pase.ci,
            fecha: fecha, //convierte a tipo fecha segun la ISO
            documento: req.file.filename,
            estado: 'true'
        }
    }
    var query = "update pase_jugador set id_club_solicitante=?,id_club_solicitado=?,ci=?,fecha=?,documento=? where id_pase=?";
    connection.query(query, [datos.nombre, datos.documento, datos.id], (err, results) => {
        if (!err) {
            if (results.affectedRows == 0) {
                return res.status(404).json({ message: "Id Pase no encontrado" });
            }
            return res.status(200).json({ message: "Pase jugador Actualizado con exito" });
        }
        else {
            return res.status(500).json(err);
        }
    })
})

//-----------------------------------------------------------------------------------------------------------

//------------ ELIMINAR REGLAMENTO---------------------------------------------------------------------------

router.delete('/delete/:id_pase', auth.authenticateToken, (req, res, next) => {
    const id_pase = req.params.id_pase;
    console.log(id_pase)
    deleteFile(id_pase);
    var query = "delete from pase_jugador where id_pase=?";
    connection.query(query, [id_pase], (err, results) => {
        if (!err) {
            if (results.affectedRows == 0) {
                return res.status(404).json({ message: "Id Pase no encontrado" });
            }
            return res.status(200).json({ message: "Pase jugador eliminado con éxito" });
        }
        else {
            console.error(err.message);
            return res.status(500).json(err);
        }
    })
})

// function deleteFile(id) {
//     connection.query('SELECT * FROM  pase_jugador WHERE id_pase = ?', [id], (err, rows, fields) => {
//         [{ documento }] = rows;
//         console.log("Documento: " + documento);
//         if (documento === '') {
//             console.log('Documento eliminado');
//         } else {
//             fs.unlinkSync('./uploads/img/' + documento);
//         }
//     });
// }

function deleteFile(id) {
    connection.query('SELECT * FROM pase_jugador WHERE id_pase = ?', [id], (err, rows) => {
        if (err) {
            console.error('Error en la consulta:', err);
            return;
        }

        if (rows.length === 0) {
            console.log('No se encontró ningún registro con el ID proporcionado.');
            return;
        }

        const { documento } = rows[0];
        console.log("Documento: " + documento);

        if (!documento) {
            console.log('No hay documento asociado al registro.');
        } else {
            const filePath = `./uploads/img/${documento}`;

            if (fs.existsSync(filePath)) {
                try {
                    fs.unlinkSync(filePath);
                    console.log('Documento eliminado exitosamente.');
                } catch (error) {
                    console.error('Error al eliminar el archivo:', error);
                }
            } else {
                console.log('El documento no existe en la carpeta indicada.');
            }
        }
    });
}
//-------------------------------------------------------------------------------------------------------------


//------------------CAMBIAR ESTADO DE REGLAMENTO---------------------------------------------------
router.patch('/updateStatus', auth.authenticateToken, checkRole.checkRole, (req, res, next) => {
    let pase = req.body;
    var query = "update pase_jugador set estado=? where id_pase=?";
    connection.query(query, [pase.estado, pase.id_pase], (err, results) => {
        if (!err) {
            if (results.affectedRows == 0) {
                return res.status(404).json({ message: "Id pase jugador no encontrado" });
            }
            return res.status(200).json({ message: "Estado pase jugador actualizado con éxito" });
        }
        else {
            return res.status(500).json(err);
        }
    })
})

//------------------------ OBTENER REGLAMENTO SEGUN ID ---------------------------------------------------
router.get('/getById/:id', auth.authenticateToken, (req, res, next) => {
    const id = req.params.id;
    var query = "select * from reglamento where id=?";
    connection.query(query, [id], (err, results) => {
        if (!err) {
            return res.status(200).json(results[0]);
        }
        else {
            return res.status(500).json(err);
        }
    })
})

module.exports = router;