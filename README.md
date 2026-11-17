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
- `npm test` ejecuta las 22 pruebas automáticas. **Borran los datos de la base configurada**, así que solo deben correr contra una base de prueba.

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

## 3. Servidor de archivos gratuito en Contabo (SeaweedFS)

> MinIO dejó de publicar versiones gratuitas en 2025; se usa **SeaweedFS** (gratuito, Apache 2.0), compatible con S3.
> El código funciona con cualquier servicio S3 cambiando solo las variables `S3_*`.

Copie `deploy/archivos/instalar.sh` al VPS y ejecútelo. Instala Docker si falta, genera claves propias,
crea el bucket, configura HTTPS (si tiene dominio) y un respaldo diario:

```bash
# Con dominio (recomendado): el subdominio debe apuntar a la IP del VPS
sudo DOMINIO=archivos.tudominio.com CORREO=tu@correo.com bash instalar.sh

# Sin dominio (temporal, HTTP por IP)
sudo bash instalar.sh
```

Al terminar muestra las variables `S3_*` para el `.env` o para Render. Luego, desde la carpeta del backend:

```bash
npm run archivos:migrar      # sube los archivos existentes de uploads/img y verifica que no falte ninguno
```

## 3.1 Base de datos

- **Base actual con datos (Contabo):** respaldar y luego `npm run migrate`. Las migraciones agregan tablas y columnas
  y convierten los estados antiguos; no borran datos.
- **Instalación nueva y vacía:** ejecutar `database/instalacion/01_esquema.sql` y luego `02_datos_iniciales.sql`
  (crea el usuario `admin@iyt.bo` con contraseña temporal `Cambiar123`).

## 4. Desplegar en Render (orden recomendado)

1. **Respaldar la base de datos** (Workbench → Data Export con estructura y datos).
2. Instalar el servidor de archivos y migrar los archivos (sección 3).
3. En Render → *Environment*, cargar todas las variables (sección 2) con `NODE_ENV=production`.
4. *Start command*: `npm start`. *Build command*: `npm install`.
5. Ejecutar las migraciones una vez contra la base real: `npm run migrate` (desde tu PC con el `.env` de producción).
6. Integrar los cambios a `main` → Render despliega solo.
7. Revisar `https://<tu-backend>.onrender.com/health`.

## 5. Roles y permisos (según los casos de uso del documento y los requerimientos del delegado)

| Módulo | Ver | Crear / editar / eliminar |
|---|---|---|
| Campeonatos, categorías, disciplinas, clubs, series | Público | Administrador, Comité técnico |
| Jugadores (lista oficial) | Con sesión (el delegado solo ve su club) | Administrador, Comité técnico |
| Solicitudes de jugadores | Delegado (su club), Comité técnico | El delegado registra y edita (todo menos CI y club); el **comité acepta u observa** |
| Equipos y jugadores del equipo | Público / con sesión | Delegado (su club y su **gestión asignada**) → "Solicitar inscripción" → el **comité aprueba, observa o rechaza** |
| Pase de jugador | Con sesión (el delegado ve los de su club) | El delegado de destino **solicita**, el de origen **acepta**, el **comité aprueba** |
| Árbitros | Con sesión | Administrador, Comité técnico |
| Fixture, partidos, hechos, medallero | Público | Administrador, Comité técnico, Responsable de categoría |
| Noticias, auspiciadores | Público | Administrador, Comité técnico, Presidente |
| Normas (reglamento) | Con sesión | Administrador, Presidente |
| Campos de juego | Público (y todos los roles) | Administrador, Comité técnico |
| Usuarios | Administrador (todos), Comité técnico (solo delegados) | Administrador: todos los roles y es el único que elimina. Comité técnico: crea, edita y activa **delegados** (club y gestión) |

El rol antiguo `user` se convierte en `delegado` con la migración.

### Estados de los flujos

- **Equipo:** `borrador` → `solicitado` → `aprobado` | `observado` (vuelve a editarse) | `rechazado`. Solo los aprobados entran al fixture.
- **Solicitud de jugador:** `borrador` → `pendiente` → `aprobado` | `observado` (con comentario; se corrige y se vuelve a enviar) | `anulado`.
- **Pase:** `solicitado` → `aceptado_origen` → `aprobado` (cambia el club) | `rechazado` | `anulado`.

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
| POST | `/equipo/solicitar` | El delegado solicita la inscripción de su equipo |
| GET | `/equipo/solicitudes` | Inscripciones por revisar (comité) |
| PATCH | `/equipo/revisar` | Aprueba, observa o rechaza la inscripción |
| GET | `/solicitudjugador/get` | Solicitudes de alta/actualización de jugadores |
| POST | `/solicitudjugador/alta` · `/solicitudjugador/actualizacion` | El delegado registra o edita un jugador (con foto y documento) |
| PATCH | `/solicitudjugador/update/:id` · `/solicitar/:id` · `/anular/:id` | Editar, enviar o anular la solicitud |
| PATCH | `/solicitudjugador/revisar/:id` | El comité acepta u observa |
| GET | `/pase/buscarJugador/:ci` | Buscar un jugador para solicitar su pase |
| POST | `/pase/solicitar` | Paso 1: el club de destino solicita el pase |
| PATCH | `/pase/responder/:id` | Paso 2: el club de origen acepta o rechaza |
| PATCH | `/pase/revisar/:id` | Paso 3: el comité aprueba o rechaza |
| GET | `/hechospartido/getByPartido/:id` | Planilla del partido con todos los hechos |
| GET | `/hechospartido/tipos` | Tipos de hecho (gol, falta, tarjeta...) |
