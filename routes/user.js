const express = require('express');
const connection = require('../connection');
const router = express.Router();

const jwt = require('jsonwebtoken');

//olvidar el password
const nodemailer = require('nodemailer');

require('dotenv').config();
var auth = require('../services/authentication');
var checkRole = require('../services/checkRole');

//------------LISTAR USUARIOS------------------------------------------------------------------------
router.get('/get', (req, res) => {
    var query = `
    SELECT 
        user.id,
        user.name,
        user.email,
        user.contactNumber,
        user.status,
        user.role,
        club.nombre AS NombreClub,
        club.id AS clubId
    FROM 
        user
    LEFT JOIN 
        club ON user.id_club = club.id;
`;
    connection.query(query, (err, results) => {
        if (!err) {
            return res.status(200).json(results);
        }
        else {
            return res.status(500).json(err);
        }
    })
})
//--------------------------------------------------------------------------------------------------//


router.post('/signup', (req, res) => {
    let user = req.body;
    query = "select email,password,role,status from user where email=?"
    connection.query(query, [user.email], (err, results) => {
        if (!err) {
            if (results.length <= 0) {
                query = "insert into user(name,contactNumber,email,password,status,role,id_club) values(?,?,?,?,'true',?,?)";
                connection.query(query, [user.name, user.contactNumber, user.email, user.password, user.role,user.clubId], (err, results) => {
                    if (!err) {
                        return res.status(200).json({ message: "Registro Exitoso" });
                    }
                    else {
                        console.error(err.message);
                        return res.status(500).json(err);
                    }
                })
            }
            else {
                return res.status(400).json({ message: "Alguien se encuentra registrado con el mismo correo" });
            }
        }
        else {
            return res.status(500).json(err);
        }
    })

})

//------------------------ MODIFICAR USUARIOS ------------------------------------------------------
router.patch('/update', auth.authenticateToken, checkRole.checkRole, (req, res, next) => {
    let user = req.body;
    var query = "update user set name=?,contactNumber=?,email=?,password=?, role=?, id_club=? where id=?";
    connection.query(query, [user.name, user.contactNumber, user.email, user.password, user.role,user.clubId, user.id], (err, results) => {
        if (!err) {
            if (results.affectedRows == 0) {
                return res.status(404).json({ message: "Usuario Id no encontrado" });
            }
            return res.status(200).json({ message: "Usuario actualizado con exito" });
        }
        else {
            console.error(err.message);
            return res.status(500).json(err);
            
        }
    })
})

//---------------- LOGIN ------------------------
router.post('/login', (req, res) => {
    const user = req.body;
    query = "select name,email,password,role,status from user where email=?";
    connection.query(query, [user.email], (err, results) => {
        if (!err) {
            if (results.length <= 0 || results[0].password != user.password) {
                return res.status(401).json({ message: "Nombre de usuario o contraseña incorrecta" });
            }
            else if (results[0].status === 'false') {
                return res.status(401).json({ message: "Esperar la aprobación del administrador" });
            }
            else if (results[0].password == user.password) {
                //GUARDAMOS CIFRADO LA CONTRASENA
                const data = { nombre: results[0].name }
                const response = { nombre: results[0].name, email: results[0].email, role: results[0].role }
                const accessToken = jwt.sign(response, 'qwertyToken', { expiresIn: '8h' })
                res.status(200).json({ token: accessToken, data: data });
            }
            else {
                return res.status(400).json({ message: "Algo salió mal. Por favor, inténtelo de nuevo más tarde" });
            }
        }
        else {
            return res.status(500).json(err);
        }
    })
})


//-------------SI SE OLVIDO LA CONTRASEÑA -------------------------
var transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'ruajms@mailinator.com',
        pass: '123456'
    }
})

router.post('/forgotPassword', (req, res) => {
    const user = req.body;
    query = "select email, password from user where email=?";
    connection.query(query, [user.email], (err, results) => {
        if (!err) {
            if (results.length <= 0) {
                return res.status(200).json({ message: "Password sent successfully to your email." });
            }
            else {
                var mailOptions = {
                    from: 'ruajms@mailinator.com',
                    to: results[0].email,
                    subject: 'Password by Cafe Managment System',
                    html: '<p><b>Your login details for cafe Managemnet System </b><br><b>Email:</b>' + results[0].email + '<br><b>Password: </b>' + results[0].password + '<br><a href="http://localhost:4200">Click here to login</a></p>'
                };
                transporter.sendMail(mailOptions, function (error, info) {
                    if (error) {
                        console.log(error);
                    }
                    else {
                        console.log('Email sent: ' + info.response);
                    }
                });
                return res.status(200).json({ message: "Password sent successfully to your email." });
            }
        }
        else {
            return res.status(500).json(err);
        }
    })
})
//--------------------------------------------------------------------------------------------------//



//------------------------ MODIFICAR ESTADO USUARIOS ------------------------------------------------------
router.patch('/updateStatus', auth.authenticateToken, checkRole.checkRole, (req, res) => {
    let user = req.body;
    var query = "update user set status=? where id=?";
    connection.query(query, [user.status, user.id], (err, results) => {
        if (!err) {
            if (results.affectedRows == 0) {
                return res.status(404).json({ message: "El usuario  no existe" });
            }
            return res.status(200).json({ message: "Actualización Estado de usuario con éxito" });
        }
        else {
            return res.status(500).json(err);
        }
    })
})
//--------------------------------------------------------------------------------------------------//

//---------------------------- ELIMINAR USUARIO ------------------------------------------------------
router.delete('/delete/:id', auth.authenticateToken, checkRole.checkRole, (req, res, next) => {
    const id = req.params.id;
    var query = "delete from user where id=?";
    connection.query(query, [id], (err, results) => {
        if (!err) {
            if (results.affectedRows == 0) {
                return res.status(404).json({ message: "Usuario Id no encontrado" });
            }
            return res.status(200).json({ message: "Usuario eliminado con éxito" });
        }
        else {
            return res.status(500).json(err);
        }
    })
})
//---------------------------------------------------------------------------------------------------

//------------------------ VERIFICAR TOKEN ---------------------------------------------------
router.get('/checktoken', auth.authenticateToken, (req, res) => {
    return res.status(200).json({ message: "true" });
})
//--------------------------------------------------------------------------------------------------//

//------------------------ CAMBIAR CONTRASENA---------------------------------------------------
router.post('/changePassword', auth.authenticateToken, (req, res) => {
    const user = req.body;
    const email = res.locals.email;
    var query = "select * from user where email=? and password=?";
    connection.query(query, [email, user.oldPassword], (err, results) => {
        if (!err) {
            if (results.length <= 0) {
                return res.status(400).json({ message: "Incorrect Old Password" });
            }
            else if (results[0].password == user.oldPassword) {
                query = "update user set password=? where email=?";
                connection.query(query, [user.newPassword, email], (err, results) => {
                    if (!err) {
                        return res.status(200).json({ message: "Password Update Successfully." })
                    }
                    else {
                        return res.status(500).json(err);
                    }
                })
            }
            else {
                res.status(400).json({ message: "Something went wrong. Please try again later" });
            }
        }
        else {
            return res.status(500).json(err);
        }
    })


    //return res.status(200).json({message:"true"});
})
//--------------------------------------------------------------------------------------------------//





module.exports = router;