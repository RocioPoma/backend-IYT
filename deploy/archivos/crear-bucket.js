// Crea el bucket configurado en el .env (S3_BUCKET). Ejecutar desde la carpeta del backend:
//   node deploy/archivos/crear-bucket.js
const { CreateBucketCommand } = require('@aws-sdk/client-s3');
const config = require('../../config');
const storage = require('../../services/storage');

if (storage.tipo !== 's3') {
  console.error('Configure STORAGE_DRIVER=s3 en el .env');
  process.exit(1);
}
storage.cliente
  .send(new CreateBucketCommand({ Bucket: config.almacenamiento.s3.bucket }))
  .then(() => console.log(`✔ Bucket "${config.almacenamiento.s3.bucket}" creado`))
  .catch((e) => {
    if (e.name === 'BucketAlreadyOwnedByYou' || e.name === 'BucketAlreadyExists') console.log('✔ El bucket ya existía');
    else { console.error('✖', e.name, e.message); process.exitCode = 1; }
  });
