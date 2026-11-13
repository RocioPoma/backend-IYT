-------- CREAMOS LA TABLA USUARIO //ya creado
create table user(
    id int primary key AUTO_INCREMENT,
    name varchar(250),
    contactNumber varchar(20),
    email varchar(50),
    password varchar(250),
    status varchar(20),
    role varchar(20),
    UNIQUE (email)
);

-------- CREAMOS LA TABLA USUARIO //ya creado
create table usuario(
    id int primary key AUTO_INCREMENT,
    nombre varchar(250),
    telefono varchar(20),
    email varchar(50),
    password varchar(250),
    estado varchar(20),
    rol varchar(20),
    UNIQUE (email)
);

insert into user(name, contactNumber,email,password,status,role) values ('Admin','71180578','admin@gmail.com','admin','true','admin');

------ CREAMOS LA TABLA CLUB //ya creado
create table club(
    id int NOT NULL AUTO_INCREMENT,
    nombre varchar(40) NOT NULL,
    comunidad varchar(40) NOT NULL,
    logo varchar(255) NOT NULL,
    primary key(id)
);

------ CREAMOS LA TABLA JUGADOR //ya creado
create table jugador(
    ci int NOT NULL,
    nombre varchar(50) NOT NULL,
    ap_paterno varchar(40),
    ap_materno varchar(40),
    fecha_nacimiento date,
    sexo varchar(25) NOT NULL,
    decendencia varchar(50) NOT NULL,
    clubId integer NOT NULL,
    fecha_habilitacion date,
    foto varchar(255),
    documento varchar(255),
    estado varchar(20),
    primary key(ci)
);

insert into jugador (ci,nombre,ap_paterno,ap_materno,fecha_nacimiento,sexo,decendencia,clubId,fecha_habilitacion,status) values(?,?,?,?,?,?,?,?,?,'true');
--- iner join
select j.id,j.ci,j.nombre,j.ap_paterno,j.ap_materno,j.fecha_nacimiento,j.sexo,j.decendencia,j.fecha_habilitacion,j.status,c.id as clubId, c.nombre as NombreClub from jugador as j INNER JOIN club as c where j.clubId = c.id;



---- CREAMOS TABLA CAMPEONATO  //ya creado

create table campeonato(
    id int NOT NULL AUTO_INCREMENT,
    nombre_campeonato varchar(255) NOT NULL,
    fecha_inicio date,
    fecha_fin date,
    convocatoria varchar(255),
    gestion int(4),
    estado varchar(20),
    primary key(id)
);

insert into campeonato (nombre_campeonato,fecha_inicio,fecha_fin,convocatoria,gestion,status) values(?,?,?,?,?,'true');
update campeonato set nombre_campeonato=?,fecha_inicio=?,fecha_fin=?,convocatoria=?,gestion=? where id=?;
      --listar campeonato
SELECT id,nombre_campeonato, fecha_inicio,fecha_fin, DATE_FORMAT(fecha_inicio, '%d-%m-%Y') as fecha_i,DATE_FORMAT(fecha_fin, '%d-%m-%Y') as fecha_f, convocatoria,gestion  FROM campeonato;


---- CREAMOS TABLA NOTICIA   //ya creado
create table noticia(
    id int NOT NULL AUTO_INCREMENT,
    titulo varchar(255) NOT NULL,
    imagen varchar(250),
    descripcion varchar(500),
    id_campeonato int,
    FOREIGN KEY(id_campeonato) REFERENCES campeonato(id),
    primary key(id)
);

---- CREAMOS TABLA REGLAMENTO O NORMAS   //ya creado
create table reglamento(
    id int NOT NULL AUTO_INCREMENT,
    nombre varchar(255),
    documento varchar(512),
    estado varchar(10),
    primary key(id)
);


---- CREAMOS TABLA DISCIPLINA  //ya creado
create table disciplina(
    id int NOT NULL AUTO_INCREMENT,
    nombre varchar(255),
    estado varchar(20),
    primary key(id)
);

---- CREAMOS TABLA CAMPEONATO-DISCIPLINA //ya creado
create table campeonato_disciplina(
    id_campeonato int,
    id_disciplina int,
    FOREIGN KEY(id_campeonato) REFERENCES campeonato(id),
    FOREIGN KEY(id_disciplina) REFERENCES disciplina(id),
    primary key(id_campeonato,id_disciplina)
);

---- CREAMOS TABLA AUSPICIADOR 
--v1 version implementad 
create table auspiciador(
    id_ausp int NOT NULL AUTO_INCREMENT,
    nit int,
    ci varchar(20),
    nombre varchar(100),
    ap_paterno varchar(50),
    ap_materno varchar(50),
    sitio varchar(255),
    telefono varchar(20),
    primary key(id_ausp)
);
--v2 version referenciasl
create table auspiciador(
    id_ausp int NOT NULL AUTO_INCREMENT,
    nombre_auspiciador varchar(255) NOT NULL,
    sitio_web varchar(255),
    telefono varchar(20),
    primary key(id_ausp)
);

create table entidad(
    nit int NOT NULL,
    primary key(nit)
);

create table persona(
    ci int NOT NULL,
    ap_paterno varchar(255) NOT NULL,
    ap_materno varchar(255),
    primary key(ci)
);
---- CREAMOS TABLA CAMPEONATO-AUSPICIADOAR 
create table campeonato_auspiciador(
    id_campeonato int,
    id_ausp int,
    FOREIGN KEY(id_campeonato) REFERENCES campeonato(id),
    FOREIGN KEY(id_ausp) REFERENCES auspiciador(id_ausp),
    primary key( id_campeonato,id_ausp)
);
----------------------------------------------------------------------------------------------------------------
---- CREAMOS TABLA CATEGORIA //ya creado
create table categoria(
    id_categoria int NOT NULL AUTO_INCREMENT,
    nombre varchar(255),
    estado varchar(20),
    primary key(id)
);

---- CREAMOS TABLA CONTEMPLA //ya creado
create table contempla(
    id int NOT NULL AUTO_INCREMENT,
    edad_min integer,
    edad_max integer,
    genero varchar(10),
    num_max_jugadores int,
    id_campeonato int,
    id_disciplina int,
    id_categoria int,
    FOREIGN KEY(id_campeonato) REFERENCES campeonato(id),
    FOREIGN KEY(id_disciplina) REFERENCES disciplina(id),
    FOREIGN KEY(id_categoria) REFERENCES categoria(id_categoria),
    primary key(id)
);

---- CREAMOS SERIE //ya creado
create table serie(
    id_serie int NOT NULL AUTO_INCREMENT,
    nombre varchar(20),
    estado varchar(20),
    primary key(id_serie)
);

---- CREAMOS ARBITRO //ya creado
create table arbitro(
    ci varchar(15) NOT NULL,
    nombre varchar(255) NOT NULL,
    ap_paterno varchar(255),
    ap_materno varchar(255), 
    telefono integer,
    funcion varchar(50),
    estado varchar(10),
    primary key(ci)
);



---- CREAMOS TABLA EQUIPO V2 //ya creado, se utilizo este
create table equipo(
    id_club int NOT NULL,
    id_contempla int NOT NULL,
    numero_sorteo int,
    id_serie int,
    FOREIGN KEY(id_club) REFERENCES club(id),
    FOREIGN KEY(id_contempla) REFERENCES contempla(id),
    FOREIGN KEY(id_serie) REFERENCES serie(id_serie),
    primary key(id_club, id_contempla)
);


---- CREAMOS TABLA EQUIPO_JUGADOR V2 //ya creado se estulizo esta version
create table equipo_jugador(
    id_club int NOT NULL,
    id_contempla int NOT NULL,
    ci varchar(15) NOT NULL,
    nro_camiseta int,
    estado varchar(10),
    FOREIGN KEY(id_club) REFERENCES equipo(id_club),
    FOREIGN KEY(id_contempla) REFERENCES equipo(id_contempla),
    FOREIGN KEY(ci) REFERENCES jugador(ci),
    primary key(id_club,id_contempla,ci)
);

---- CREAMOS CANCHA //ya creado
create table cancha(
    id_cancha int NOT NULL AUTO_INCREMENT,
    nombre varchar(100),
    direccion varchar(512),
    primary key(id_cancha)
);

---- CREAMOS TABLA PARTIDO //ya creado
create table partido(
    id int AUTO_INCREMENT,
    fecha date,
    hora time,
    estado varchar(15),
    id_equipo1 int,
    id_equipo2 int,
    id_cancha int,
    FOREIGN KEY(id_equipo1) REFERENCES equipo(id),
    FOREIGN KEY(id_equipo2) REFERENCES equipo(id),
    FOREIGN KEY(id_cancha) REFERENCES cancha(id_cancha),
    primary key( id)
);
---- CREAMOS TABLA PARTIDO V2 //ya creado
create table partido1(
    id int AUTO_INCREMENT NOT NULL,
    fecha date,
    hora time,
    estado varchar(15),
    id_equipo1 int,
    id_equipo2 int,
    id_contempla int,
    id_cancha int,
    total_equipo1 int,
    total_equipo2 int,
    puntos_equipo1 int,
    puntos_equipo2 int,
    FOREIGN KEY(id_contempla) REFERENCES equipo(id_contempla),
    FOREIGN KEY(id_equipo1) REFERENCES equipo(id_club),
    FOREIGN KEY(id_equipo2) REFERENCES equipo(id_club),
    FOREIGN KEY(id_cancha) REFERENCES cancha(id_cancha),
    primary key(id)
);


---- CREAMOS TABLA PARTIDO-ARBITRO //ya creado
create table partido_arbitro(
    id_partido int,
    ci varchar(15),
    FOREIGN KEY(id_partido) REFERENCES partido(id_partido),
    FOREIGN KEY(ci) REFERENCES arbitro(ci),
    primary key( id_partido,ci)
);

---- CREAMOS HECHOS DE DISCIPLINA //ya creado
create table hechos_disciplinas(
    id_hecho int NOT NULL AUTO_INCREMENT,
    nombre varchar(30),
    primary key(id_hecho)
);

---- CREAMOS ALL_TIMES //ya creado
create table all_times(
    id_time int NOT NULL AUTO_INCREMENT,
    nombre varchar(30),
    primary key(id_time)
);
---- CREAMOS TABLA HECHOS PARTIDO-------------------------------------
create table hechos_partido(
    id_hechos_partido int NOT NULL AUTO_INCREMENT,
    id_partido int,
    ci varchar(15),
    id_club int,
    id_contempla int,
    id_hecho int,
    id_time int,
    descripcion_hecho varchar(255),
    FOREIGN KEY(id_partido) REFERENCES partido(id_partido),
    FOREIGN KEY(ci) REFERENCES equipo_jugador(ci),
    FOREIGN KEY(id_club) REFERENCES equipo_jugador(id_equipo),
    FOREIGN KEY(id_contempla) REFERENCES equipo_jugador(id_contempla),
    FOREIGN KEY(id_hecho) REFERENCES hechos_disciplinas(id_hecho),
    FOREIGN KEY(id_time) REFERENCES all_times(id_time),
    primary key(id_hechos_partido)
);

---- CREAMOS TABLA PASE JUGADOR //ya creado
create table pase_jugador(
    id_pase int NOT NULL AUTO_INCREMENT,
    id_club_solicitante int,
    id_club_solicitado int,
    ci int NOT NULL,
    fecha date,
    documento varchar(255) NOT NULL,
    estado varchar(10),
    FOREIGN KEY(ci) REFERENCES jugador(ci),
    FOREIGN KEY(id_club_solicitante) REFERENCES club(id),
    FOREIGN KEY(id_club_solicitado) REFERENCES club(id),
    primary key(id_pase)
);

---- CREAMOS TABLA MEDALLERO //ya creado
create table medallero(
    id_medallero int NOT NULL AUTO_INCREMENT,
    id_contempla int,
    id_club int,
    FOREIGN KEY(id_contempla) REFERENCES contempla(id),
    FOREIGN KEY(id_club) REFERENCES club(id),
    primary key(id_medallero )
);




-----------------------------------------------------------------------------------------------
-----------------------------------------------------------------------------------------------
-- ELIMINAR CAMPO
ALTER TABLE noticia DROP COLUMN id_noticia;

--- AGREGAR CAMPO
ALTER TABLE noticia
ADD id_campeonato int

-- AGREGAR FOREIGN KEY DESPUES DE AGREGAR UN CAMPO
ALTER TABLE noticia ADD  FOREIGN KEY (id_campeonato) REFERENCES campeonato(id);

--- SELECT CON CASE Y WHEN Y THEN 1 ELSE 0 END
select p.nombre,p.ci,m.id_equipo,  case when m.id_equipo!=21  then false else true end as checked
from jugador p,  equipo_jugador m ,equipo c where m.id_equipo=21 and m.ci=p.ci and c.id=m.id_equipo;

-----------------------------------------------------------------------------------------------
-----------------------------------------------------------------------------------------------





------- CREAMOS LA TABLA BILL (FACTURA)
create table bill(
    id int NOT NULL AUTO_INCREMENT,
    uuid varchar(200) NOT NULL,
    name varchar(255) NOT NULL,
    email varchar(255) NOT NULL,
    contactNumber varchar(20) NOT NULL,
    paymentMethod varchar(20) NOT NULL,
    total int not null,
    cameonatoDetails JSON DEFAULT NULL,
    createBy varchar(255) NOT NULL,
    primary key(id)
);

-----extra
productDetails: "[{\"id\":1,\"name\": \"getById\", \"price\":93, \"total\": 93, \"category\": \"Pizza\", \"quantity\": \"1\"}]"

"[{"id":2,"name":"Test2","description":"Test descrition","price":93,"status":"false","categoryId":2,"categoryName":"Pizza"}]"