#!/usr/bin/env bash
# Deploy isolated wa-desk stack on VPS (does not touch DownItX + Pinquill)
set -euo pipefail

DEPLOY_DIR="/opt/wa-desk"
REPO_URL="https://github.com/sulmanamazon25-ctrl/wa-desk.git"
COMPOSE_FILE="deploy/wa-desk/docker-compose.yml"

echo "==> Docker status"
systemctl enable docker
systemctl start docker
docker version

echo "==> Prepare deploy dir"
mkdir -p "$DEPLOY_DIR"
cd "$DEPLOY_DIR"

if [ ! -d .git ]; then
  git clone "$REPO_URL" .
else
  git fetch origin
  git reset --hard origin/master
fi

echo "==> Write production env"
cat > deploy/wa-desk/.env <<'ENVEOF'
WA_DB_PASSWORD=20Zano9MYQuZgKDupH0ES0dgGWl2t6lG
LICENSE_SIGNING_SECRET=9269452fa3d220ca5ac7c35d0d6f3978995fd3dc68a3ad7da58d8384999c6d6c
ADMIN_API_KEY=ff37fadfde6ecef0d37c98850fc717c6b84024e94ee8c768dd489fab10d5056d
NODE_ENV=production
PORT=3025
HOSTNAME=0.0.0.0
NEXT_PUBLIC_APP_URL=http://194.9.62.143:3025
DOWNLOAD_URL=http://194.9.62.143:3025/download
ENVEOF

echo "==> Build and start stack"
docker compose -f "$COMPOSE_FILE" --env-file deploy/wa-desk/.env down || true
docker compose -f "$COMPOSE_FILE" --env-file deploy/wa-desk/.env up -d --build

echo "==> Containers"
docker compose -f "$COMPOSE_FILE" ps

echo "==> Health check"
for i in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:3025/pricing" >/dev/null 2>&1; then
    echo "wa-desk is up on port 3025"
    exit 0
  fi
  sleep 5
done

echo "wa-desk not ready — check logs: docker compose -f $COMPOSE_FILE logs wa-desk"
exit 1
