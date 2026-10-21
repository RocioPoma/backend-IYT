const mysql = require('mysql2');

// Configuración de conexión para el pool
const pool = mysql.createPool({
    connectionLimit: 30,
    host: '13.140.229.173',
    port: 3306,
    user: 'app_node',
    password: 'Proverbios3:5',
    database: 'bdd_campeonatos_v02',
    ssl: { rejectUnauthorized: false }
});

// Obtener una conexión del pool y realizar operaciones
pool.getConnection((err, connection) => {
    if (err) {
        console.error('Error al obtener la conexión del pool:', err);
        return;
    }

    // Ejecutar operaciones con la conexión
    connection.query('SELECT 1 + 1 AS result', (queryErr, results) => {
        if (queryErr) {
            console.error('Error en la consulta:', queryErr);
        } else {
            console.log('CONNECTED:', results[0].result);
        }

        // Devolver la conexión al pool
        connection.release();
    });
});

// Manejar eventos de error del pool
pool.on('error', (err) => {
    console.error('Error en el pool de MySQL:');
    console.error(err);
});

// Exportar el pool para su uso en otros módulos
module.exports = pool;



/*const mysql = require('mysql');
require('dotenv').config();

var connection = mysql.createConnection({
    port: process.env.DB_PORT,
    host: process.env.DB_HOST,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

connection.connect((err)=>{
    if(!err){
        console.log("CONNECTED");
    }
    else{
        console.log('ERROR: ');
        console.log(err);
    }
})

module.exports = connection; */
