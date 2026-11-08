#!/bin/sh
set -eu
cd /root/ifa-app/deploy/vps
python3 prepare-demo.py
api_container=$(docker compose -f compose.yml ps -q api)
docker cp demo-credentials.json "$api_container":/tmp/ifa-demo-credentials.json
docker cp demo-assets "$api_container":/tmp/ifa-demo-assets
docker cp seed-demo.mjs "$api_container":/app/server/seed-demo.mjs
docker exec -u root "$api_container" chown node:node /tmp/ifa-demo-credentials.json
docker exec "$api_container" node seed-demo.mjs
docker exec -u root "$api_container" rm -f /tmp/ifa-demo-credentials.json /app/server/seed-demo.mjs
