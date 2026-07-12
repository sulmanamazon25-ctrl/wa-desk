# One-shot deploy for Coolify Terminal (Server → Terminal in Coolify UI)
# Safe: only touches wa-desk containers on port 3025

set -euo pipefail

mkdir -p /opt/wa-desk && cd /opt/wa-desk

if [ ! -d .git ]; then
  git clone https://github.com/sulmanamazon25-ctrl/wa-desk.git .
else
  git pull --ff-only origin master
fi

cat > deploy/wa-desk/.env <<'EOF'
WA_DB_PASSWORD=20Zano9MYQuZgKDupH0ES0dgGWl2t6lG
LICENSE_SIGNING_SECRET=9269452fa3d220ca5ac7c35d0d6f3978995fd3dc68a3ad7da58d8384999c6d6c
ADMIN_API_KEY=ff37fadfde6ecef0d37c98850fc717c6b84024e94ee8c768dd489fab10d5056d
NODE_ENV=production
PORT=3025
HOSTNAME=0.0.0.0
NEXT_PUBLIC_APP_URL=http://194.9.62.143:3025
DOWNLOAD_URL=http://194.9.62.143:3025/download
EOF

systemctl enable docker
systemctl start docker
if ! docker info >/dev/null 2>&1; then
  echo "Docker not responding — restarting..."
  systemctl restart docker
  sleep 3
fi
docker version

docker compose -f deploy/wa-desk/docker-compose.yml --env-file deploy/wa-desk/.env down || true
docker compose -f deploy/wa-desk/docker-compose.yml --env-file deploy/wa-desk/.env up -d --build

docker compose -f deploy/wa-desk/docker-compose.yml ps
curl -fsS http://127.0.0.1:3025/pricing && echo " OK"
