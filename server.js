//require('dotenv').config();
const http = require('http');
/* const express = require("express");
const server = express(); */
const app = require('./index');
const server = http.createServer(app);

server.listen(80, () => {
  console.log("FUNCIONA")
});


//LOCAL HOST
// server.listen(4000,()=>{
//   console.log('FUNCIONA');
// })

