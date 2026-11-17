// Pruebas de punta a punta contra una base de datos de PRUEBA (nunca usar la de producción).
// Requiere el .env apuntando a una BD de prueba con el esquema y las migraciones aplicadas.
// Ejecutar: npm test
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

process.env.NODE_ENV = 'test';
const app = require('../index');
const connection = require('../connection');
const { generarRoundRobin } = require('../routes/partido');

const db = connection.consulta;
let tokenAdmin;
let tokenDelegado;
const tokenDelegadoActual = () => tokenDelegado;
const ids = {};

async function limpiar() {
  for (const t of ['medallero', 'hechos_partido', 'partido', 'equipo_jugador', 'equipo', 'pase_jugador', 'jugador_solicitud', 'contempla',
    'noticia', 'jugador', 'user', 'campeonato', 'categoria', 'disciplina', 'cancha', 'arbitro', 'club']) {
    await db(`DELETE FROM \`${t}\``);
  }
}

before(async () => {
  const [{ base }] = await db('SELECT DATABASE() AS base');
  assert.ok(/test|prueba|bdd_campeonatos_v02/.test(base));
  await limpiar();
  const c1 = await db("INSERT INTO club (nombre, comunidad) VALUES ('Aurora','Yareta')");
  const c2 = await db("INSERT INTO club (nombre, comunidad) VALUES ('Bolivar','Yareta')");
  const c3 = await db("INSERT INTO club (nombre, comunidad) VALUES ('Ingavi','Yareta')");
  ids.clubs = [c1.insertId, c2.insertId, c3.insertId];
  ids.disciplina = (await db("INSERT INTO disciplina (nombre, estado) VALUES ('Futbol','true')")).insertId;
  ids.categoria = (await db("INSERT INTO categoria (nombre, estado) VALUES ('Libre','true')")).insertId;
  ids.campeonato = (await db("INSERT INTO campeonato (nombre_campeonato, gestion, status) VALUES ('XX Campeonato', 2026, 'true')")).insertId;
  ids.contempla = (await db(
    "INSERT INTO contempla (edad_min, edad_max, genero, id_campeonato, id_disciplina, id_categoria, estado, num_max_jugadores) VALUES (15,40,'Masculino',?,?,?,'true',2)",
    [ids.campeonato, ids.disciplina, ids.categoria]
  )).insertId;
  // Usuario antiguo con contraseña sin cifrar: debe poder entrar y quedar cifrado
  await db("INSERT INTO user (name,email,password,status,role) VALUES ('Admin','admin@iyt.bo','clave123','true','admin')");
  await db("INSERT INTO user (name,email,password,status,role,id_club,gestion) VALUES ('Delegado','dele@iyt.bo','clave123','true','user',?,2026)", [ids.clubs[0]]);
  await db("INSERT INTO user (name,email,password,status,role,id_club,gestion) VALUES ('Delegado2','dele2@iyt.bo','clave123','true','delegado',?,2026)", [ids.clubs[1]]);
  await db("INSERT INTO user (name,email,password,status,role) VALUES ('Comite','comite@iyt.bo','clave123','true','comite_tecnico')");
  await db("INSERT INTO jugador (ci,nombre,ap_paterno,ap_materno,fecha_nacimiento,sexo,clubId,status) VALUES ('111','Juan','Perez','Lopez','2000-01-01','Masculino',?,'true')", [ids.clubs[0]]);
  await db("INSERT INTO jugador (ci,nombre,ap_paterno,ap_materno,fecha_nacimiento,sexo,clubId,status) VALUES ('222','Luis','Coro','Mamani','2001-01-01','Masculino',?,'true')", [ids.clubs[1]]);
});

after(async () => {
  await limpiar();
  await connection.cerrar();
});

test('round robin: cada equipo juega una vez contra cada rival', () => {
  for (const n of [2, 3, 4, 5, 8, 9]) {
    const equipos = Array.from({ length: n }, (_, i) => i + 1);
    const rondas = generarRoundRobin(equipos);
    const pares = rondas.flat().map(([a, b]) => [a, b].sort().join('-'));
    assert.equal(new Set(pares).size, (n * (n - 1)) / 2, `n=${n}`);
    assert.equal(pares.length, (n * (n - 1)) / 2);
    for (const ronda of rondas) {
      const enRonda = ronda.flat();
      assert.equal(new Set(enRonda).size, enRonda.length, 'nadie juega dos veces en la misma fecha');
    }
  }
});

test('login con contraseña antigua sin cifrar funciona y la cifra', async () => {
  const r = await request(app).post('/user/login').send({ email: 'ADMIN@iyt.bo', password: 'clave123' });
  assert.equal(r.status, 200);
  assert.ok(r.body.token);
  tokenAdmin = r.body.token;
  const [u] = await db("SELECT password FROM user WHERE email='admin@iyt.bo'");
  assert.match(u.password, /^\$2[aby]\$/);
  const r2 = await request(app).post('/user/login').send({ email: 'admin@iyt.bo', password: 'clave123' });
  assert.equal(r2.status, 200);
  const mal = await request(app).post('/user/login').send({ email: 'admin@iyt.bo', password: 'otra' });
  assert.equal(mal.status, 401);
});

test('el rol antiguo "user" entra como delegado', async () => {
  const r = await request(app).post('/user/login').send({ email: 'dele@iyt.bo', password: 'clave123' });
  assert.equal(r.status, 200);
  assert.equal(r.body.data.role, 'delegado');
  tokenDelegado = r.body.token;
});

test('registro público queda pendiente y como delegado (no puede elegir admin)', async () => {
  const r = await request(app).post('/user/signup').send({ name: 'Intruso', email: 'x@x.com', password: 'secreto1', role: 'admin' });
  assert.equal(r.status, 200);
  const [u] = await db("SELECT role, status, password FROM user WHERE email='x@x.com'");
  assert.equal(u.role, 'delegado');
  assert.equal(u.status, 'false');
  assert.match(u.password, /^\$2/);
  const login = await request(app).post('/user/login').send({ email: 'x@x.com', password: 'secreto1' });
  assert.equal(login.status, 401);
});

test('la lista de usuarios ya no es pública', async () => {
  assert.equal((await request(app).get('/user/get')).status, 401);
  assert.equal((await request(app).get('/user/get').set('Authorization', `Bearer ${tokenDelegado}`)).status, 403);
  const r = await request(app).get('/user/get').set('Authorization', `Bearer ${tokenAdmin}`);
  assert.equal(r.status, 200);
  assert.ok(r.body.every((u) => u.password === undefined));
});

test('vista pública: campeonatos, noticias, canchas y partidos sin login; jugadores no', async () => {
  for (const ruta of ['/campeonato/get', '/noticia/get', '/cancha/get', '/club/get', `/partido/tabla/${ids.contempla}`]) {
    assert.equal((await request(app).get(ruta)).status, 200, ruta);
  }
  assert.equal((await request(app).get('/jugador/get')).status, 401);
});

test('escrituras protegidas: sin sesión 401, con rol insuficiente 403', async () => {
  assert.equal((await request(app).post('/noticia/add').send({ titulo: 'x' })).status, 401);
  assert.equal((await request(app).delete(`/campeonato/delete/${ids.campeonato}`)).status, 401);
  assert.equal((await request(app).post('/dcategoriacampeonato/add').send({})).status, 401);
  assert.equal(
    (await request(app).post('/club/add').set('Authorization', `Bearer ${tokenDelegado}`).send({ nombre: 'Nuevo', comunidad: 'X' })).status,
    403
  );
});

test('delegado: inscribe su equipo en su gestión, lo arma y solicita; el comité aprueba', async () => {
  const otro = await request(app).post('/equipo/add').set('Authorization', `Bearer ${tokenDelegado}`)
    .send({ id_club: ids.clubs[1], id_contempla: ids.contempla });
  assert.equal(otro.status, 403);
  // otra gestión: no puede
  await db("UPDATE user SET gestion=2025 WHERE email='dele@iyt.bo'");
  const gest = await request(app).post('/equipo/add').set('Authorization', `Bearer ${tokenDelegado}`)
    .send({ id_club: ids.clubs[0], id_contempla: ids.contempla });
  assert.equal(gest.status, 403);
  assert.match(gest.body.message, /gestión 2025/);
  await db("UPDATE user SET gestion=2026 WHERE email='dele@iyt.bo'");

  const r = await request(app).post('/equipo/add').set('Authorization', `Bearer ${tokenDelegado}`)
    .send({ id_club: ids.clubs[0], id_contempla: ids.contempla, numero_sorteo: 1 });
  assert.equal(r.status, 200);
  const [e] = await db('SELECT estado FROM equipo WHERE id_club=?', [ids.clubs[0]]);
  assert.equal(e.estado, 'borrador');
  // sin jugadores no puede solicitar
  const vacio = await request(app).post('/equipo/solicitar').set('Authorization', `Bearer ${tokenDelegado}`)
    .send({ id_club: ids.clubs[0], id_contempla: ids.contempla });
  assert.equal(vacio.status, 400);
});

test('jugadores del equipo: solo de su club y sin duplicar en la categoría', async () => {
  const ok = await request(app).post('/equipojugador/add').set('Authorization', `Bearer ${tokenDelegado}`)
    .send({ id_club: ids.clubs[0], id_contempla: ids.contempla, ci: '111' });
  assert.equal(ok.status, 200);
  const ajeno = await request(app).post('/equipojugador/add').set('Authorization', `Bearer ${tokenAdmin}`)
    .send({ id_club: ids.clubs[0], id_contempla: ids.contempla, ci: '222' });
  assert.equal(ajeno.status, 400);

  await request(app).post('/equipo/solicitar').set('Authorization', `Bearer ${tokenDelegado}`)
    .send({ id_club: ids.clubs[0], id_contempla: ids.contempla }).expect(200);
  // solicitado: el delegado ya no puede cambiar jugadores
  const bloqueado = await request(app).delete(`/equipojugador/delete/${ids.clubs[0]}/${ids.contempla}/111`).set('Authorization', `Bearer ${tokenDelegado}`);
  assert.equal(bloqueado.status, 400);
  // el delegado no puede aprobarse a sí mismo
  await request(app).patch('/equipo/revisar').set('Authorization', `Bearer ${tokenDelegado}`)
    .send({ id_club: ids.clubs[0], id_contempla: ids.contempla, estado: 'aprobado' }).expect(403);
  const comite = (await request(app).post('/user/login').send({ email: 'comite@iyt.bo', password: 'clave123' })).body.token;
  const pend = await request(app).get('/equipo/solicitudes').set('Authorization', `Bearer ${comite}`);
  assert.equal(pend.body.length, 1);
  // observar exige comentario
  await request(app).patch('/equipo/revisar').set('Authorization', `Bearer ${comite}`)
    .send({ id_club: ids.clubs[0], id_contempla: ids.contempla, estado: 'observado' }).expect(400);
  await request(app).patch('/equipo/revisar').set('Authorization', `Bearer ${comite}`)
    .send({ id_club: ids.clubs[0], id_contempla: ids.contempla, estado: 'aprobado' }).expect(200);
  const [e] = await db('SELECT estado FROM equipo WHERE id_club=?', [ids.clubs[0]]);
  assert.equal(e.estado, 'aprobado');
});

test('fixture, resultado, tabla de posiciones y medallero', async () => {
  for (const [i, club] of [ids.clubs[1], ids.clubs[2]].entries()) {
    const r = await request(app).post('/equipo/add').set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ id_club: club, id_contempla: ids.contempla, numero_sorteo: i + 2 });
    assert.equal(r.status, 200);
  }
  const fx = await request(app).post('/partido/add_fixture').set('Authorization', `Bearer ${tokenAdmin}`)
    .send({ id_contempla: ids.contempla, id_serie: 0 });
  assert.equal(fx.status, 200, fx.text);
  const partidos = (await request(app).get(`/partido/get/${ids.contempla}/0`)).body;
  assert.equal(partidos.length, 3); // 3 equipos → 3 partidos, uno descansa en cada fecha
  const repetido = await request(app).post('/partido/add_fixture').set('Authorization', `Bearer ${tokenAdmin}`)
    .send({ id_contempla: ids.contempla, id_serie: 0 });
  assert.equal(repetido.status, 400);

  const p = partidos[0];
  await request(app).patch('/partido/updateResultadoPartido').set('Authorization', `Bearer ${tokenAdmin}`)
    .send({ id_partido: p.id_partido, total_equipo1: 2, total_equipo2: 1 }).expect(200);
  await request(app).patch('/partido/updateStatus').set('Authorization', `Bearer ${tokenAdmin}`)
    .send({ id_partido: p.id_partido, estado: 'Cerrado' }).expect(200);

  const tabla = (await request(app).get(`/partido/tabla/${ids.contempla}`)).body;
  assert.equal(tabla.length, 3);
  assert.equal(tabla[0].id_club, p.id_equipo1);
  assert.equal(tabla[0].pts, 3);
  assert.equal(tabla[0].gf, 2);
  assert.equal(tabla[0].dg, 1);

  await request(app).post('/medallero/registrar').set('Authorization', `Bearer ${tokenAdmin}`)
    .send({ id_contempla: ids.contempla, primero: ids.clubs[0], segundo: ids.clubs[1], tercero: ids.clubs[2] }).expect(200);
  const med = (await request(app).get(`/medallero/campeonato/${ids.campeonato}`)).body;
  assert.equal(med.resumen.length, 3);
  assert.equal(med.resumen[0].oro, 1);
  // delegado no puede registrar medallero
  await request(app).post('/medallero/registrar').set('Authorization', `Bearer ${tokenDelegado}`)
    .send({ id_contempla: ids.contempla, primero: ids.clubs[0] }).expect(403);
});

test('campo de juego: CRUD y programar partido con cancha y árbitro', async () => {
  await request(app).post('/cancha/add').set('Authorization', `Bearer ${tokenAdmin}`)
    .send({ nombre: 'Cancha Principal', direccion: 'Plaza', tipo: 'Fútbol' }).expect(200);
  const [c] = await db("SELECT id_cancha FROM cancha WHERE nombre='Cancha Principal'");
  await db("INSERT INTO arbitro (ci,nombre,ap_paterno,ap_materno,estado) VALUES ('999','Pedro','Rojas','Vega','true')");
  const [p] = await db('SELECT id_partido FROM partido LIMIT 1');
  await request(app).patch('/partido/programar').set('Authorization', `Bearer ${tokenAdmin}`)
    .send({ id_partido: p.id_partido, fecha: '2026-12-01', hora: '15:30', id_cancha: c.id_cancha, id_arbitro: '999' }).expect(200);
  const [det] = (await request(app).get(`/partido/getPartido/${p.id_partido}`)).body;
  assert.equal(det.nombre_cancha, 'Cancha Principal');
  assert.equal(det.nombre_arbitro, 'Pedro Rojas Vega');
  assert.equal(det.hora_f, '15:30');
});

test('noticias: se guardan con fecha y la imagen va al servidor de archivos', async () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  const r = await request(app).post('/noticia/add').set('Authorization', `Bearer ${tokenAdmin}`)
    .field('titulo', 'Inauguración').field('descripcion', 'Gran inauguración').field('id_campeonato', String(ids.campeonato))
    .attach('imagen', png, { filename: 'Foto Ñandú.png', contentType: 'image/png' });
  assert.equal(r.status, 200, r.text);
  const [n] = (await request(app).get('/noticia/get')).body;
  assert.ok(n.fecha);
  assert.match(n.imagen, /^\d+-Foto_Nandu\.png$/);
  const img = await request(app).get(`/uploads/img/${n.imagen}`);
  assert.equal(img.status, 200);
  assert.equal(img.headers['content-type'], 'image/png');
  assert.equal(img.body.length, png.length);

  // tipo de archivo no permitido
  const malo = await request(app).post('/noticia/add').set('Authorization', `Bearer ${tokenAdmin}`)
    .field('titulo', 'x').attach('imagen', Buffer.from('MZ'), { filename: 'virus.exe', contentType: 'application/x-msdownload' });
  assert.equal(malo.status, 400);

  // al eliminar la noticia se elimina el archivo
  await request(app).delete(`/noticia/delete/${n.id}`).set('Authorization', `Bearer ${tokenAdmin}`).expect(200);
  assert.equal((await request(app).get(`/uploads/img/${n.imagen}`)).status, 404);
});

test('documentos personales del jugador solo con sesión', async () => {
  const pdf = Buffer.from('%PDF-1.4\n%prueba\n');
  await request(app).patch('/jugador/subir_documento').set('Authorization', `Bearer ${tokenAdmin}`)
    .field('ci', '111').attach('documento', pdf, { filename: 'carnet.pdf', contentType: 'application/pdf' }).expect(200);
  const [j] = await db("SELECT documento FROM jugador WHERE ci='111'");
  assert.equal((await request(app).get(`/uploads/img/${j.documento}`)).status, 401);
  assert.equal((await request(app).get(`/uploads/img/${j.documento}?token=${tokenAdmin}`)).status, 200);
});

test('pase de jugador exige la hoja firmada y cambia el club', async () => {
  const sin = await request(app).post('/pase/add').set('Authorization', `Bearer ${tokenAdmin}`)
    .field('ci', '222').field('id_club_solicitante', String(ids.clubs[2])).field('id_club_solicitado', String(ids.clubs[1]));
  assert.equal(sin.status, 400);
  const pdf = Buffer.from('%PDF-1.4\n%pase\n');
  const r = await request(app).post('/pase/add').set('Authorization', `Bearer ${tokenAdmin}`)
    .field('ci', '222').field('id_club_solicitante', String(ids.clubs[2])).field('id_club_solicitado', String(ids.clubs[1]))
    .field('fecha', '2026-11-13').attach('documento', pdf, { filename: 'pase.pdf', contentType: 'application/pdf' });
  assert.equal(r.status, 200, r.text);
  const [j] = await db("SELECT clubId FROM jugador WHERE ci='222'");
  assert.equal(j.clubId, ids.clubs[2]);
  const lista = (await request(app).get('/pase/get').set('Authorization', `Bearer ${tokenAdmin}`)).body;
  assert.equal(lista.length, 1);
});

test('renovar sesión y cambiar contraseña', async () => {
  const r = await request(app).post('/user/refresh').set('Authorization', `Bearer ${tokenDelegado}`);
  assert.equal(r.status, 200);
  assert.ok(r.body.token);
  tokenDelegado = r.body.token;
  await request(app).post('/user/changePassword').set('Authorization', `Bearer ${r.body.token}`)
    .send({ oldPassword: 'clave123', newPassword: 'nueva456' }).expect(200);
  await request(app).post('/user/login').send({ email: 'dele@iyt.bo', password: 'nueva456' }).expect(200);
});

test('recuperar contraseña con enlace de un solo uso', async () => {
  await request(app).post('/user/forgotPassword').send({ email: 'admin@iyt.bo' }).expect(200);
  const [u] = await db("SELECT reset_token FROM user WHERE email='admin@iyt.bo'");
  assert.ok(u.reset_token);
  // simular el token: lo fijamos a un valor conocido
  const crypto = require('crypto');
  const token = 'a'.repeat(64);
  await db("UPDATE user SET reset_token=? WHERE email='admin@iyt.bo'", [crypto.createHash('sha256').update(token).digest('hex')]);
  await request(app).post('/user/resetPassword').send({ token, password: 'recuperada1' }).expect(200);
  await request(app).post('/user/resetPassword').send({ token, password: 'otra1234' }).expect(400);
  await request(app).post('/user/login').send({ email: 'admin@iyt.bo', password: 'recuperada1' }).expect(200);
});

test('los errores de base de datos no exponen detalles internos', async () => {
  const r = await request(app).post('/categoria/add').set('Authorization', `Bearer ${tokenAdmin}`).send({ nombre: 'x'.repeat(400) });
  assert.ok([400, 500].includes(r.status));
  assert.ok(!JSON.stringify(r.body).includes('sqlMessage'));
});

test('delegado: solicitud de alta de jugador → comité observa → corrige → comité acepta', async () => {
  const foto = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  const r = await request(app).post('/solicitudjugador/alta').set('Authorization', `Bearer ${tokenDelegadoActual()}`)
    .field('ci', '7770001').field('nombre', 'Ana').field('ap_paterno', 'Quispe').field('ap_materno', '')
    .field('fecha_nacimiento', '2002-03-04').field('sexo', 'Femenino').field('id_club', String(ids.clubs[2]))
    .attach('foto', foto, { filename: 'ana.png', contentType: 'image/png' });
  assert.equal(r.status, 200, r.text);
  const [sol] = await db("SELECT * FROM jugador_solicitud WHERE ci='7770001'");
  assert.equal(sol.estado, 'borrador');
  assert.equal(sol.id_club, ids.clubs[0]); // el club lo pone el sistema, no el delegado
  assert.equal((await db("SELECT ci FROM jugador WHERE ci='7770001'")).length, 0); // aún no está en la lista oficial
  // otro delegado no la ve ni la toca
  const t2 = (await request(app).post('/user/login').send({ email: 'dele2@iyt.bo', password: 'clave123' })).body.token;
  assert.equal((await request(app).get('/solicitudjugador/get').set('Authorization', `Bearer ${t2}`)).body.length, 0);
  await request(app).patch(`/solicitudjugador/solicitar/${sol.id}`).set('Authorization', `Bearer ${t2}`).expect(403);
  // la foto pendiente no es pública
  assert.equal((await request(app).get(`/uploads/img/${sol.foto}`)).status, 401);

  await request(app).patch(`/solicitudjugador/solicitar/${sol.id}`).set('Authorization', `Bearer ${tokenDelegadoActual()}`).expect(200);
  const comite = (await request(app).post('/user/login').send({ email: 'comite@iyt.bo', password: 'clave123' })).body.token;
  await request(app).patch(`/solicitudjugador/revisar/${sol.id}`).set('Authorization', `Bearer ${tokenDelegadoActual()}`)
    .send({ decision: 'aceptar' }).expect(403);
  await request(app).patch(`/solicitudjugador/revisar/${sol.id}`).set('Authorization', `Bearer ${comite}`)
    .send({ decision: 'observar', observacion: 'Falta la foto del carnet' }).expect(200);
  const lista = (await request(app).get('/solicitudjugador/get').set('Authorization', `Bearer ${tokenDelegadoActual()}`)).body;
  assert.equal(lista[0].estado, 'observado');
  assert.equal(lista[0].observacion, 'Falta la foto del carnet');

  const pdf = Buffer.from('%PDF-1.4\n%carnet\n');
  await request(app).patch(`/solicitudjugador/update/${sol.id}`).set('Authorization', `Bearer ${tokenDelegadoActual()}`)
    .field('ap_materno', 'Mamani').attach('documento', pdf, { filename: 'carnet.pdf', contentType: 'application/pdf' }).expect(200);
  await request(app).patch(`/solicitudjugador/solicitar/${sol.id}`).set('Authorization', `Bearer ${tokenDelegadoActual()}`).expect(200);
  await request(app).patch(`/solicitudjugador/revisar/${sol.id}`).set('Authorization', `Bearer ${comite}`)
    .send({ decision: 'aceptar' }).expect(200);
  const [j] = await db("SELECT * FROM jugador WHERE ci='7770001'");
  assert.equal(j.clubId, ids.clubs[0]);
  assert.equal(j.ap_materno, 'Mamani');
  assert.equal(j.status, 'true');
  assert.ok(j.documento);
});

test('delegado: actualización de jugador (no cambia CI ni club) y solo se aplica al aceptar', async () => {
  const r = await request(app).post('/solicitudjugador/actualizacion').set('Authorization', `Bearer ${tokenDelegadoActual()}`)
    .field('ci', '7770001').field('nombre', 'Ana María').field('id_club', String(ids.clubs[2])).field('enviar', 'true');
  assert.equal(r.status, 200, r.text);
  assert.equal((await db("SELECT nombre FROM jugador WHERE ci='7770001'"))[0].nombre, 'Ana'); // todavía no cambia
  // jugador de otro club: no
  const ajeno = await request(app).post('/solicitudjugador/actualizacion').set('Authorization', `Bearer ${tokenDelegadoActual()}`)
    .field('ci', '222').field('nombre', 'X');
  assert.equal(ajeno.status, 403);
  // el delegado no puede eliminar jugadores
  await request(app).delete('/jugador/delete/7770001').set('Authorization', `Bearer ${tokenDelegadoActual()}`).expect(403);
  // y solo ve los de su club
  const lista = (await request(app).get('/jugador/get').set('Authorization', `Bearer ${tokenDelegadoActual()}`)).body;
  assert.ok(lista.length > 0 && lista.every((x) => x.clubId === ids.clubs[0]));

  const comite = (await request(app).post('/user/login').send({ email: 'comite@iyt.bo', password: 'clave123' })).body.token;
  await request(app).patch(`/solicitudjugador/revisar/${r.body.id}`).set('Authorization', `Bearer ${comite}`)
    .send({ decision: 'aceptar' }).expect(200);
  const [j] = await db("SELECT nombre, clubId FROM jugador WHERE ci='7770001'");
  assert.equal(j.nombre, 'Ana María');
  assert.equal(j.clubId, ids.clubs[0]);
});

test('pase en 3 pasos: destino solicita, origen acepta, comité aprueba', async () => {
  const t2 = (await request(app).post('/user/login').send({ email: 'dele2@iyt.bo', password: 'clave123' })).body.token; // club 2 (destino)
  const comite = (await request(app).post('/user/login').send({ email: 'comite@iyt.bo', password: 'clave123' })).body.token;
  const busca = await request(app).get('/pase/buscarJugador/7770001').set('Authorization', `Bearer ${t2}`);
  assert.equal(busca.status, 200);
  assert.equal(busca.body.fecha_nacimiento, undefined);

  await request(app).post('/pase/solicitar').set('Authorization', `Bearer ${t2}`).field('ci', '7770001').expect(200);
  await request(app).post('/pase/solicitar').set('Authorization', `Bearer ${t2}`).field('ci', '7770001').expect(400); // ya en trámite
  const [p] = await db("SELECT * FROM pase_jugador WHERE ci='7770001'");
  assert.equal(p.estado, 'solicitado');
  assert.equal(p.id_club_solicitado, ids.clubs[0]);
  // el comité no puede aprobar antes que el club de origen
  await request(app).patch(`/pase/revisar/${p.id_pase}`).set('Authorization', `Bearer ${comite}`).send({ decision: 'aprobar' }).expect(400);
  // el club destino no puede responder por el origen
  await request(app).patch(`/pase/responder/${p.id_pase}`).set('Authorization', `Bearer ${t2}`).field('decision', 'aceptar').expect(403);
  await request(app).patch(`/pase/responder/${p.id_pase}`).set('Authorization', `Bearer ${tokenDelegadoActual()}`).field('decision', 'aceptar').expect(200);
  assert.equal((await db("SELECT clubId FROM jugador WHERE ci='7770001'"))[0].clubId, ids.clubs[0]); // aún no cambia
  // el delegado no puede dar la aprobación final
  await request(app).patch(`/pase/revisar/${p.id_pase}`).set('Authorization', `Bearer ${tokenDelegadoActual()}`).send({ decision: 'aprobar' }).expect(403);
  await request(app).patch(`/pase/revisar/${p.id_pase}`).set('Authorization', `Bearer ${comite}`).send({ decision: 'aprobar' }).expect(200);
  assert.equal((await db("SELECT clubId FROM jugador WHERE ci='7770001'"))[0].clubId, ids.clubs[1]);
  // cada delegado ve solo los pases de su club
  const otros = (await request(app).get('/pase/get').set('Authorization', `Bearer ${t2}`)).body;
  assert.ok(otros.every((x) => [x.id_club_solicitante, x.id_club_solicitado].includes(ids.clubs[1])));
});

test('campos de juego: el delegado los ve pero no los modifica', async () => {
  assert.equal((await request(app).get('/cancha/get').set('Authorization', `Bearer ${tokenDelegadoActual()}`)).status, 200);
  await request(app).post('/cancha/add').set('Authorization', `Bearer ${tokenDelegadoActual()}`).send({ nombre: 'X' }).expect(403);
});

test('comité técnico: crea, edita y activa delegados, pero no otros roles ni elimina', async () => {
  const comite = (await request(app).post('/user/login').send({ email: 'comite@iyt.bo', password: 'clave123' })).body.token;
  const C = (r) => r.set('Authorization', `Bearer ${comite}`);
  // crear delegado: queda activo, con club y gestión
  await C(request(app).post('/user/signup')).send({ name: 'Nuevo Delegado', email: 'nd@iyt.bo', password: 'secreto1', role: 'delegado', clubId: ids.clubs[2], gestion: 2026 }).expect(200);
  const [nd] = await db("SELECT id, role, status, id_club, gestion FROM user WHERE email='nd@iyt.bo'");
  assert.deepEqual([nd.role, nd.status, nd.id_club, nd.gestion], ['delegado', 'true', ids.clubs[2], 2026]);
  // no puede crear otros roles ni delegados sin club
  await C(request(app).post('/user/signup')).send({ name: 'Otro Admin', email: 'oa@iyt.bo', password: 'secreto1', role: 'admin' }).expect(403);
  await C(request(app).post('/user/signup')).send({ name: 'Sin Club', email: 'sc@iyt.bo', password: 'secreto1', role: 'delegado' }).expect(400);
  // la lista solo muestra delegados
  const lista = (await C(request(app).get('/user/get'))).body;
  assert.ok(lista.length > 0 && lista.every((u) => ['delegado', 'user'].includes(u.role)));
  // editar delegado (gestión) sí; convertirlo en admin no; editar al administrador no
  await C(request(app).patch('/user/update')).send({ id: nd.id, name: 'Nuevo Delegado', email: 'nd@iyt.bo', role: 'delegado', clubId: ids.clubs[2], gestion: 2027 }).expect(200);
  await C(request(app).patch('/user/update')).send({ id: nd.id, name: 'Nuevo Delegado', email: 'nd@iyt.bo', role: 'admin', clubId: ids.clubs[2] }).expect(403);
  const [adm] = await db("SELECT id FROM user WHERE email='admin@iyt.bo'");
  await C(request(app).patch('/user/update')).send({ id: adm.id, name: 'Hack', email: 'admin@iyt.bo', role: 'admin' }).expect(403);
  // activar/desactivar delegados sí; al administrador no
  await C(request(app).patch('/user/updateStatus')).send({ id: nd.id, status: 'false' }).expect(200);
  await C(request(app).patch('/user/updateStatus')).send({ id: adm.id, status: 'false' }).expect(403);
  // eliminar: solo el administrador
  await C(request(app).delete(`/user/delete/${nd.id}`)).expect(403);
});
