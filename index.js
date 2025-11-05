const express = require('express');
var cors = require('cors');
const path = require('path');
const connection = require('./connection');

//rutas
const userRoute = require('./routes/user');
const clubRoute = require('./routes/club');
const jugadorRoute = require('./routes/jugador');
const billRoute = require('./routes/bill');
const dashboardRoute = require('./routes/dashboard');
const campeonatoRoute = require('./routes/campeonato');
const noticiaRoute = require('./routes/noticia');
const dcampeonatoRoute = require('./routes/detallecampeonato');
const reglamentoRoute = require('./routes/reglamento');
const arbitroRoute = require('./routes/arbitro');
const disciplinaRoute = require('./routes/disciplina');
const categoriaRoute = require('./routes/categoria');
const dcategoriacampeonatoRoute = require('./routes/dcategoriascampeonato');
const equipoRoute = require('./routes/equipo');
const partidoRoute = require('./routes/partido');
const equipoJugadorRoute = require('./routes/equipo_jugador');
const serieRoute = require('./routes/serie');
const hechosPartidoRoute = require('./routes/hechos_partido');
const paseJugadorRoute = require('./routes/pase_jugador');
const auspiciadorRoute = require('./routes/auspiciador');


//const path = require('path');

const app = express();

//Middleware
//app.use(cors({ origen: '*' }));
// ✅ CORRECTO — Configuración de CORS
const allowedOrigins = ['https://iyt.netlify.app']; // tu dominio de Netlify

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('No permitido por CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true, // si usas tokens o cookies
}));

// Manejar preflight (opcional pero recomendable)
app.options('*', cors());

////-----------------------------------
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// app.get("/api/test", (req, res) => {
//     res.send("El Servidor Responde Bien");
//   });

app.get("/", (req, res) => {
    res.send("El Servidor Responde Bien");
});

app.use('/uploads', express.static(path.resolve('uploads')));
//rutas componentes
app.use('/user', userRoute);
app.use('/club', clubRoute);
app.use('/jugador', jugadorRoute);
app.use('/bill', billRoute);
app.use('/dashboard', dashboardRoute);
app.use('/campeonato', campeonatoRoute);
app.use('/noticia', noticiaRoute);
app.use('/dcampeonato', dcampeonatoRoute);
app.use('/reglamento', reglamentoRoute);
app.use('/arbitro', arbitroRoute);
app.use('/disciplina', disciplinaRoute);
app.use('/categoria', categoriaRoute);
app.use('/dcategoriacampeonato', dcategoriacampeonatoRoute);
app.use('/equipo', equipoRoute);
app.use('/partido', partidoRoute);
app.use('/equipojugador', equipoJugadorRoute);
app.use('/serie', serieRoute);
app.use('/hechospartido', hechosPartidoRoute);
app.use('/pase', paseJugadorRoute);
app.use('/auspiciador', auspiciadorRoute)
/*
app.use('/api/uploads',express.static(path.resolve('uploads')));
//rutas componentes
app.use('/api/user',userRoute);
app.use('/api/club',clubRoute);
app.use('/api/jugador',jugadorRoute);
app.use('/api/bill',billRoute);
app.use('/api/dashboard',dashboardRoute);
app.use('/api/campeonato',campeonatoRoute);
app.use('/api/noticia',noticiaRoute);
app.use('/api/dcampeonato',dcampeonatoRoute);
app.use('/api/reglamento',reglamentoRoute);
app.use('/api/arbitro',arbitroRoute);
app.use('/api/disciplina',disciplinaRoute);
app.use('/api/categoria',categoriaRoute);
app.use('/api/dcategoriacampeonato',dcategoriacampeonatoRoute);
app.use('/api/equipo',equipoRoute);
app.use('/api/partido',partidoRoute);
app.use('/api/equipojugador',equipoJugadorRoute);
app.use('/api/serie',serieRoute);
app.use('/api/hechospartido',hechosPartidoRoute);
app.use('/api/pase',paseJugadorRoute);
*/


module.exports = app;