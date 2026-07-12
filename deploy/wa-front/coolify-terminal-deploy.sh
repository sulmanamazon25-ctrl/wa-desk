#!/usr/bin/env bash
# Deploy marketing frontend on 46.62.226.89 (existing Coolify project)
set -euo pipefail

mkdir -p /opt/wa-front && cd /opt/wa-front

if [ ! -d .git ]; then
  git clone https://github.com/sulmanamazon25-ctrl/wa-desk.git .
else
  git pull --ff-only origin master
fi

cat > deploy/wa-front/.env <<'EOF'
NODE_ENV=production
PORT=3025
HOSTNAME=0.0.0.0
NEXT_PUBLIC_APP_URL=http://46.62.226.89:3025
NEXT_PUBLIC_API_ORIGIN=http://194.9.62.143:3025
NEXT_PUBLIC_DOWNLOAD_URL=http://46.62.226.89:3025/download
EOF

systemctl enable docker
systemctl start docker
docker compose -f deploy/wa-front/docker-compose.yml --env-file deploy/wa-front/.env down || true
docker compose -f deploy/wa-front/docker-compose.yml --env-file deploy/wa-front/.env up -d --build
docker compose -f deploy/wa-front/docker-compose.yml ps
curl -fsS http://127.0.0.1:3025/pricing && echo " OK"
