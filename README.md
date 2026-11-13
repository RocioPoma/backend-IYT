# Backend IYT: Sistema de campeonatos de la Integración Yaretanense

API en Node.js + Express + MySQL. Los archivos (fotos, logos, convocatorias, documentos) se guardan en un
**servidor de archivos compatible con S3** y el backend es quien los lee y los entrega.

---

## 1. Ejecutar en local

Requisitos: **Node.js 22** y acceso a una base de datos MySQL **de prueba**.

```bash
npm install
cp .env.example .env        # y completa los valores
npm run migrate             # aplica los cambios de base de datos (una sola vez)
npm run dev                 # http://localhost:4000
```

- Con `STORAGE_DRIVER=local`, los archivos se guardan en la carpeta `uploads/` (solo para desarrollo).
- `GET /health` indica si la API, la base de datos y el servidor de archivos están funcionando.
- `npm test` ejecuta las pruebas automáticas. **Borran los datos de la base configurada**, así que solo deben correr contra una base de prueba.

## 2. Variables de entorno

Ver `.env.example`. Las importantes:

| Variable | Para qué |
|---|---|
| `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Conexión a MySQL |
| `JWT_SECRET` | Clave para firmar las sesiones (mínimo 32 caracteres, aleatoria) |
| `JWT_EXPIRES` | Inactividad máxima antes de pedir login otra vez (por defecto `30m`) |
| `CORS_ORIGINS` | Dominios del frontend permitidos, separados por coma |
| `STORAGE_DRIVER` | `s3` en producción, `local` en desarrollo |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` | Servidor de archivos |
| `SMTP_*`, `FRONTEND_URL` | Correo para "olvidé mi contraseña" |

**Nunca** escribas contraseñas en el código: van solo en `.env` (local) o en el panel de Render/servidor.

## 3. Servidor de archivos en Contabo (SeaweedFS)

> MinIO dejó de publicar versiones gratuitas en 2025; se usa **SeaweedFS** (Apache 2.0), compatible con S3.
> El código funciona con cualquier servicio S3 (por ejemplo, *Contabo Object Storage*) cambiando solo las variables `S3_*`.

En el VPS (Ubuntu), con Docker instalado:

```bash
sudo mkdir -p /opt/iyt-archivos/data
cd /opt/iyt-archivos
# copiar aquí deploy/archivos/docker-compose.yml y s3.json.example
cp s3.json.example s3.json
nano s3.json                    # poner accessKey y secretKey propias (largas y aleatorias)
docker compose up -d
```

Para generar claves: `openssl rand -hex 16` (accessKey) y `openssl rand -hex 32` (secretKey).

**Publicarlo con HTTPS** (necesario mientras el backend esté en Render): crear un subdominio
(ej. `archivos.tudominio.com`) apuntando a la IP del VPS y usar `deploy/archivos/nginx-archivos.conf` + `certbot`.
Cuando el backend también esté en el VPS, usará `S3_ENDPOINT=http://127.0.0.1:8333` y no hará falta publicarlo.

Luego, desde la carpeta del backend con el `.env` apuntando al servidor de archivos:

```bash
node deploy/archivos/crear-bucket.js     # crea el bucket
npm run archivos:migrar                  # sube los archivos existentes de uploads/img
```

El script indica al final si algún archivo que aparece en la base de datos no se encontró.

## 4. Desplegar en Render (orden recomendado)

1. **Respaldar la base de datos** (Workbench → Data Export con estructura y datos).
2. Instalar el servidor de archivos y migrar los archivos (sección 3).
3. En Render → *Environment*, cargar todas las variables (sección 2) con `NODE_ENV=production`.
4. *Start command*: `npm start`. *Build command*: `npm install`.
5. Ejecutar las migraciones una vez contra la base real: `npm run migrate` (desde tu PC con el `.env` de producción).
6. Integrar los cambios a `main` → Render despliega solo.
7. Revisar `https://<tu-backend>.onrender.com/health`.

## 5. Roles y permisos (según los casos de uso del documento)

| Módulo | Ver | Crear / editar / eliminar |
|---|---|---|
| Campeonatos, categorías, disciplinas, clubs, series | Público | Administrador, Comité técnico |
| Jugadores, árbitros, pases | Con sesión | Administrador, Comité técnico |
| Equipos y jugadores del equipo | Público / con sesión | Administrador, Comité técnico, Delegado (solo su club; queda pendiente de aprobación) |
| Fixture, partidos, hechos, medallero | Público | Administrador, Comité técnico, Responsable de categoría |
| Noticias | Público | Administrador, Comité técnico, Presidente |
| Auspiciadores | Público | Administrador, Comité técnico, Presidente |
| Normas (reglamento) | Con sesión | Administrador, Presidente |
| Campos de juego | Público | Administrador, Comité técnico |
| Usuarios | Administrador | Administrador |

El rol antiguo `user` se convierte en `delegado` con la migración.

## 6. Endpoints nuevos

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | Estado de API, BD y archivos |
| POST | `/user/refresh` | Renueva la sesión mientras el usuario está activo |
| POST | `/user/resetPassword` | Restablece la contraseña con el enlace enviado por correo |
| GET | `/partido/tabla/:id_contempla` | Tabla de posiciones (PTS, PJ, PG, PE, PP, GF, GC, DG); `?en_vivo=1` incluye partidos en juego |
| GET | `/partido/ranking/:id_contempla` | Ranking de jugadores; `?id_hecho=N` para otro tipo de hecho |
| GET | `/partido/proximos` | Próximos partidos y partidos en vivo |
| PATCH | `/partido/programar` | Asigna fecha, hora, campo de juego y árbitro a un partido |
| GET/POST/PATCH/DELETE | `/cancha/...` | Campos de juego |
| GET | `/medallero/campeonato/:id` | Medallero del campeonato (resumen por club y detalle) |
| POST | `/medallero/registrar` | Registra 1.º, 2.º y 3.º lugar de una categoría |
| PATCH | `/equipo/updateStatus` | Aprueba o rechaza la inscripción de un equipo |
| GET | `/hechospartido/getByPartido/:id` | Planilla del partido con todos los hechos |
| GET | `/hechospartido/tipos` | Tipos de hecho (gol, falta, tarjeta...) |
