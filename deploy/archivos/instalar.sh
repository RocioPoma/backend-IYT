#!/usr/bin/env bash
# =====================================================================================
#  Servidor de archivos GRATUITO (SeaweedFS, compatible con S3) para el VPS de Contabo.
#  Probado en Ubuntu 24.04. Ejecutar como root:
#
#    Con dominio (recomendado, HTTPS gratis con Let's Encrypt):
#      sudo DOMINIO=archivos.tudominio.com CORREO=tu@correo.com bash instalar.sh
#
#    Sin dominio (HTTP por IP; solo mientras el backend siga en Render):
#      sudo bash instalar.sh
#
#  Al final muestra las variables S3_* que se copian en el .env del backend / en Render.
# =====================================================================================
set -euo pipefail

DIR=/opt/iyt-archivos
BUCKET=${BUCKET:-iyt-archivos}
DOMINIO=${DOMINIO:-}
CORREO=${CORREO:-}
VERSION=${VERSION:-4.53}

if [ "$(id -u)" -ne 0 ]; then echo "Ejecute con sudo"; exit 1; fi
echo "==> Instalando el servidor de archivos en $DIR"

# 1. Docker
if ! command -v docker >/dev/null 2>&1; then
  echo "==> Instalando Docker"
  apt-get update -q
  apt-get install -y -q docker.io docker-compose-v2
  systemctl enable --now docker
fi

mkdir -p "$DIR/data" "$DIR/respaldos"
cd "$DIR"

# 2. Credenciales (se generan una sola vez)
if [ ! -f s3.json ]; then
  ACCESS=$(openssl rand -hex 12)
  SECRET=$(openssl rand -hex 32)
  cat > s3.json <<JSON
{
  "identities": [
    {
      "name": "backend-iyt",
      "credentials": [{ "accessKey": "$ACCESS", "secretKey": "$SECRET" }],
      "actions": ["Read", "Write", "List", "Tagging", "Admin"]
    }
  ]
}
JSON
fi
# El servidor dentro del contenedor no corre como root: necesita poder leer el archivo.
# (Solo root entra a este VPS; la carpeta /opt/iyt-archivos queda solo para root.)
chmod 644 s3.json
chmod 711 "$DIR"
ACCESS=$(grep -o '"accessKey": "[^"]*"' s3.json | cut -d'"' -f4)
SECRET=$(grep -o '"secretKey": "[^"]*"' s3.json | cut -d'"' -f4)

# 3. Contenedor. Con dominio solo escucha en el propio servidor (Nginx lo publica con HTTPS).
if [ -n "$DOMINIO" ]; then PUERTO="127.0.0.1:8333:8333"; else PUERTO="8333:8333"; fi
cat > docker-compose.yml <<YML
services:
  archivos:
    image: chrislusf/seaweedfs:$VERSION
    container_name: iyt-archivos
    restart: unless-stopped
    command: >
      server -dir=/data -ip.bind=0.0.0.0
      -master.volumeSizeLimitMB=1024 -volume.max=0
      -s3 -s3.port=8333 -s3.config=/etc/seaweedfs/s3.json
    ports:
      - "$PUERTO"
    volumes:
      - $DIR/data:/data
      - $DIR/s3.json:/etc/seaweedfs/s3.json:ro
YML
docker compose up -d
echo "==> Esperando a que el servidor arranque"
LISTO=0
for i in $(seq 1 45); do
  if docker exec iyt-archivos sh -c "echo 's3.bucket.list' | weed shell -master=localhost:9333" >/dev/null 2>&1; then LISTO=1; break; fi
  sleep 2
done
if [ "$LISTO" -ne 1 ]; then
  echo "!! El servidor de archivos no arrancó. Últimas líneas del registro:"
  docker logs --tail 30 iyt-archivos || true
  exit 1
fi

# 4. Bucket
if ! docker exec iyt-archivos sh -c "echo 's3.bucket.list' | weed shell -master=localhost:9333" 2>/dev/null | grep -q "^ *$BUCKET\b"; then
  docker exec iyt-archivos sh -c "echo 's3.bucket.create -name $BUCKET' | weed shell -master=localhost:9333"
fi

# 5. Publicación
if [ -n "$DOMINIO" ]; then
  echo "==> Configurando Nginx + HTTPS para $DOMINIO"
  apt-get install -y -q nginx certbot python3-certbot-nginx
  cat > /etc/nginx/sites-available/iyt-archivos <<NGINX
server {
    listen 80;
    server_name $DOMINIO;
    client_max_body_size 20m;
    location / {
        proxy_pass http://127.0.0.1:8333;
        proxy_set_header Host \$http_host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_request_buffering off;
        proxy_buffering off;
    }
}
NGINX
  ln -sf /etc/nginx/sites-available/iyt-archivos /etc/nginx/sites-enabled/iyt-archivos
  nginx -t && systemctl reload nginx
  if command -v ufw >/dev/null && ufw status | grep -q active; then ufw allow 'Nginx Full'; fi
  certbot --nginx -d "$DOMINIO" --non-interactive --agree-tos -m "${CORREO:-admin@$DOMINIO}" --redirect
  ENDPOINT="https://$DOMINIO"
else
  if command -v ufw >/dev/null && ufw status | grep -q active; then ufw allow 8333/tcp; fi
  IP=$(curl -s -4 ifconfig.me || hostname -I | awk '{print $1}')
  ENDPOINT="http://$IP:8333"
  echo "!! Sin dominio el servidor queda en HTTP. Las peticiones van firmadas (la clave secreta no viaja),"
  echo "!! pero el contenido de los archivos no va cifrado. Úselo solo de forma temporal."
fi

# 6. Respaldo diario (03:30), se conservan 7 días
cat > /etc/cron.d/iyt-archivos-respaldo <<CRON
30 3 * * * root tar czf $DIR/respaldos/archivos-\$(date +\%F).tar.gz -C $DIR data && find $DIR/respaldos -name 'archivos-*.tar.gz' -mtime +7 -delete
CRON

echo
echo "================= LISTO ================="
echo "Copie estas variables en el .env del backend (o en Render → Environment):"
echo
echo "STORAGE_DRIVER=s3"
echo "S3_ENDPOINT=$ENDPOINT"
echo "S3_REGION=us-east-1"
echo "S3_BUCKET=$BUCKET"
echo "S3_ACCESS_KEY=$ACCESS"
echo "S3_SECRET_KEY=$SECRET"
echo "S3_FORCE_PATH_STYLE=true"
echo
echo "Si el backend está en este mismo VPS use: S3_ENDPOINT=http://127.0.0.1:8333"
echo "Archivos en: $DIR/data   ·   Respaldos diarios en: $DIR/respaldos"
