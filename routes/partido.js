const express = require("express");
const connection = require('../connection');
const router = express.Router();
var auth = require('../services/authentication');
var checkRole = require('../services/checkRole');


//-------------------------------- AGREGAR y GENERAR FIXTURE --------------------------------
router.post('/add_fixture', auth.authenticateToken, (req, res, next) => {

    let partido = req.body;
    var datosEquipo = [];
    var nSerie = 1;
    if (partido.id_serie == 'por serie') {
        nSerie = 2;
    }

    connection.query('select e.id_club,e.numero_sorteo, c.nombre as nombre from equipo e, club c'
        + ' where e.id_club=c.id and id_contempla=? and e.id_serie=? order by numero_sorteo;', [partido.id_contempla, partido.id_serie], (err, results, rows) => {
            if (!err) {
                //datosEquipo = res.status(200).json(results);
                //console.log('Resultado: '+ JSON.stringify(results));
                datosEquipo = results;
            }
            else {
                console.log(res.status(500).json(err));
            }
            n = datosEquipo.length;
            console.log("tamano n " + n);
            nNew = n;//numero de equipos
            if (n % 2 != 0) {
                nNew = n + 1;
            }
            nRonda = nNew - 1;
            nPartidoRonda = nNew / 2;
            console.log("nPartidoRonda " + nPartidoRonda);
            var arr = new Array(n);
            var arr1 = new Array();
            var arr2 = new Array();

            for (let i = 1; i <= nNew; i++) {
                if (n % 2 != 0 && i == nNew) {
                    arr[i] = 7
                } else {
                    //arr[i]=i;
                    arr[i] = datosEquipo[i - 1].id_club;
                }
                //console.log("Datos Array " + arr[i]);
            }
            c1 = 1;
            c3 = 2;
            for (i = 1; i <= nRonda; i++) {
                c2 = nNew;
                console.log('Ronda ' + i);
                for (j = 1; j <= nPartidoRonda; j++) {
                    if (i == 1) {
                        if (j == 1) {
                            arr1[c1] = arr[j]
                            arr2[c1] = arr[c3]
                            c3++;
                        }
                        else {
                            arr1[c1] = arr[c2];
                            arr2[c1] = arr[c3];
                            c3++;
                            c2--;
                        }
                    }
                    else {
                        if (j == 1) {
                            arr1[c1] = arr[j];
                            arr2[c1] = arr1[c1 - (nPartidoRonda - 1)]
                        }
                        else if (j < nPartidoRonda) {
                            arr1[c1] = arr1[c1 - (nPartidoRonda - 1)]
                            arr2[c1] = arr2[c1 - (nPartidoRonda + 1)]
                        } else if (j == nPartidoRonda) {
                            arr1[c1] = arr2[c1 - (nPartidoRonda)]
                            arr2[c1] = arr2[c1 - (nPartidoRonda + 1)]
                        }
                    }
                     console.log(arr1[c1]);
                     console.log(arr2[c1]);

                    //------------ Insertamos a la tabla partido
                    let datosp = {};

                    datosp = {
                        id_equipo1: arr1[c1],
                        id_equipo2: arr2[c1],
                        id_contempla: partido.id_contempla,
                        estado: 'No realizado',
                        total_equipo1: 0,
                        total_equipo2: 0,
                        id_serie: partido.id_serie
                    }
                    console.log(datosp);
                    connection.query('insert into partido set ?', [datosp], (err, results) => {
                        if (!err) {
                            return console.log("lo logramos");
                            // return res.status(200).json({ message: "Fixture generado con exito" });
                        }
                        else {
                            return res.status(500).json(err);
                            //return console.log("error 500");
                        }
                    });
                    //------------------------------------------
                    c1++;
                }
            }
            return res.status(200).json({ message: "Fixture generado con exito" });
          // return console.log("se logro");
        })

});

//-------------------------------- LISTAR PARTIDOS DE UNA CATEGORIA ESPECIFICO-----------------------------------------------------
router.get('/get/:id_contempla/:id_serie', auth.authenticateToken, (req, res, next) => {
    const id_contempla = req.params.id_contempla;
    const id_serie = req.params.id_serie;
    connection.query('select p.*, c1.nombre as equipo1, c2.nombre as equipo2 from club c1, club c2, partido p'
        + ' where p.id_equipo1=c1.id and p.id_equipo2=c2.id and p.id_contempla =? and p.id_serie=?;', [id_contempla, id_serie], (err, results) => {
            if (!err) {
                return res.status(200).json(results);
            }
            else {
                return res.status(500).json(err);
            }
        })
})

//-------------------------------- LISTAR DATOS DE UN PARTIDO ESPECIFICA-----------------------------------------------------
router.get('/getPartido/:id_partido', auth.authenticateToken, (req, res, next) => {
    const { id_partido } = req.params;
    connection.query('select p.*, c1.nombre as equipo1, c2.nombre as equipo2 from club c1, club c2, partido p'
        + ' where p.id_equipo1=c1.id and p.id_equipo2=c2.id and p.id_partido =?;', [id_partido], (err, results) => {
            if (!err) {
                return res.status(200).json(results);
            }
            else {
                return res.status(500).json(err);
            }
        })
})

//------------ ELIMINAR---------------------------------------------------------------------------
router.delete('/delete/:id_contempla', auth.authenticateToken, (req, res, next) => {
    const id = req.params.id_contempla;
    var query = "delete partido"
        + " from partido"
        + " join contempla"
        + " on partido.id_contempla = contempla.id"
        + " where contempla.id=?;"
    connection.query(query, [id], (err, results) => {
        if (!err) {
            if (results.affectedRows == 0) {
                return res.status(404).json({ message: "Id no encontrado" });
            }
            return res.status(200).json({ message: "Fixture eliminado con éxito" });
        }
        else {
            return res.status(500).json(err);
        }
    })
})

//------------------CAMBIAR ESTADO PARTIDO (No realizado, cerrado, en vivo)---------------------------------------------------
router.patch('/updateStatus', auth.authenticateToken, checkRole.checkRole, (req, res, next) => {
    let partido = req.body;
    var query = "update partido set estado=? where id_partido=?";
    connection.query(query, [partido.estado, partido.id_partido], (err, results) => {
        if (!err) {
            if (results.affectedRows == 0) {
                return res.status(404).json({ message: "ID partido no encontrado" });
            }
            return res.status(200).json({ message: "Estado Partido actualizado con éxito" });
        }
        else {
            return res.status(500).json(err);
        }
    })
})


//------------------CAMBIAR ESTADO PARTIDO (No realizado, cerrado, en vivo)---------------------------------------------------
router.patch('/updateResultadoPartido', auth.authenticateToken, checkRole.checkRole, (req, res, next) => {
    let partido = req.body;
    let puntos_equipo1=0;
    let puntos_equipo2=0;
    if (partido.total_equipo1 == partido.total_equipo2) {
        puntos_equipo1=1;
        puntos_equipo2=1;
    } else if (partido.total_equipo1 > partido.total_equipo2) {
        puntos_equipo1=3;
        puntos_equipo2=0;
    }else if (partido.total_equipo1 < partido.total_equipo2) {
        puntos_equipo1=0;
        puntos_equipo2=3;
    }else{
        puntos_equipo1=0;
        puntos_equipo2=0;
    }

    console.log(partido);
    var query = "update partido set total_equipo1=?,total_equipo2=?,puntos_equipo1=?,puntos_equipo2=? where id_partido=?";
    connection.query(query, [partido.total_equipo1, partido.total_equipo2, puntos_equipo1,puntos_equipo2,partido.id_partido], (err, results) => {
        if (!err) {
            if (results.affectedRows == 0) {
                return res.status(404).json({ message: "ID partido no encontrado" });
            }
            return res.status(200).json({ message: "Resultados Partido actualizado con éxito" });
        }
        else {
            return res.status(500).json(err);
        }
    })
})


//---------------------------------------------------------------------------------------------------------------------------------



//-------------------------------------------------------------------------------------------------
//---------------------------------------------------------------------------------------------------------------------------------

//-------------------------------- MOSTRAR/LISTAR -----------------------

router.get("/get_all", auth.authenticateToken, (req, res) => {
    connection.query('select  e.*, b.nombre as nombre_club'
        + 'from equipo e, club b'
        + 'where e.id_club=b.id', (err, results) => {
            if (!err) {
                return res.status(200).json(results);
            }
            else {
                return res.status(500).json(err);
            }
        });
});




//------------------------ MODIFICAR ---------------------------------------------------
router.patch('/update', auth.authenticateToken, (req, res, next) => {
    let equipo = req.body;
    let datos = {};

    datos = {
        id: equipo.id,
        id_club: equipo.id_club,
        id_serie: equipo.id_serie,
        numero_sorteo: equipo.numero_sorteo
    }

    var query = "update equipo set id_club=?,id_serie=?,numero_sorteo=? where id=?";
    connection.query(query, [datos.id_club, datos.id_serie, datos.numero_sorteo, datos.id], (err, results) => {
        if (!err) {
            if (results.affectedRows == 0) {
                return res.status(404).json({ message: "Id Equipo no encontrado" });
            }
            return res.status(200).json({ message: "Equipo Actualizado con exito" });
        }
        else {
            return res.status(500).json(err);
        }
    })
})

//-----------------------------------------------------------------------------------------------------------




//------------------------ OBTENER  SEGUN ID ---------------------------------------------------
router.get('/getById/:id', auth.authenticateToken, (req, res, next) => {
    const id = req.params.id;
    var query = "select * from equipo where id=?";
    connection.query(query, [id], (err, results) => {
        if (!err) {
            return res.status(200).json(results[0]);
        }
        else {
            return res.status(500).json(err);
        }
    })
})

//-------------------------- FIXTURE 



module.exports = router;