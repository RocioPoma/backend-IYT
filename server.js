require('dotenv').config();
const http = require('http');
/* const express = require("express");
const server = express(); */
const app = require('./index');
const server = http.createServer(app);

const PORT=process.env.PORT;

server.listen(PORT, () => {
  console.log("FUNCIONA")
});


// LOCAL HOST
// server.listen(4000,()=>{
//   console.log('FUNCIONA');
// })

