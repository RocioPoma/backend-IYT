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
const ids = {};

async function limpiar() {
  for (const t of ['medallero', 'hechos_partido', 'partido', 'equipo_jugador', 'equipo', 'pase_jugador', 'contempla',
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
  await db("INSERT INTO user (name,email,password,status,role,id_club) VALUES ('Delegado','dele@iyt.bo','clave123','true','user',?)", [ids.clubs[0]]);
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

test('delegado inscribe su equipo (queda pendiente) pero no el de otro club', async () => {
  const otro = await request(app).post('/equipo/add').set('Authorization', `Bearer ${tokenDelegado}`)
    .send({ id_club: ids.clubs[1], id_contempla: ids.contempla });
  assert.equal(otro.status, 403);
  const r = await request(app).post('/equipo/add').set('Authorization', `Bearer ${tokenDelegado}`)
    .send({ id_club: ids.clubs[0], id_contempla: ids.contempla, numero_sorteo: 1 });
  assert.equal(r.status, 200);
  const [e] = await db('SELECT estado FROM equipo WHERE id_club=?', [ids.clubs[0]]);
  assert.equal(e.estado, 'pendiente');
  const ap = await request(app).patch('/equipo/updateStatus').set('Authorization', `Bearer ${tokenAdmin}`)
    .send({ id_club: ids.clubs[0], id_contempla: ids.contempla, estado: 'aprobado' });
  assert.equal(ap.status, 200);
});

test('jugadores del equipo: solo de su club y sin duplicar en la categoría', async () => {
  const ok = await request(app).post('/equipojugador/add').set('Authorization', `Bearer ${tokenDelegado}`)
    .send({ id_club: ids.clubs[0], id_contempla: ids.contempla, ci: '111' });
  assert.equal(ok.status, 200);
  const ajeno = await request(app).post('/equipojugador/add').set('Authorization', `Bearer ${tokenAdmin}`)
    .send({ id_club: ids.clubs[0], id_contempla: ids.contempla, ci: '222' });
  assert.equal(ajeno.status, 400);
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
