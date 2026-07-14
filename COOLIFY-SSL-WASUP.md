# Coolify / Traefik SSL for wasup.app (manual UI fallback)

Use this only if terminal deploy (`docker compose` + override) is missing or Traefik stops routing.

## DNS (prerequisite)

| Host | Type | Value |
|------|------|-------|
| `wasup.app` | A | `46.62.226.89` |
| `www.wasup.app` | CNAME or A | `46.62.226.89` |
| `api.wasup.app` | A | `194.9.62.143` |

## Option A — Keep terminal stacks (recommended)

Stacks run outside Coolify apps but must join the **`coolify`** Docker network and carry Traefik labels (see `deploy/wa-front/docker-compose.override.yml` and `deploy/wa-desk/docker-compose.override.yml`).

On each server:

```bash
cd /opt/wa-front/deploy/wa-front   # or /opt/wa-desk/deploy/wa-desk
docker compose up -d --force-recreate
```

Verify:

- `https://wasup.app/pricing` → **200**
- `https://api.wasup.app/api/license/validate` → **401** (no body) when app is up

## Option B — Coolify UI (if you migrate to managed apps)

### Front (46.62.226.89)

1. Open Coolify → **Projects** → server `46.62.226.89` → **+ New Resource** → **Docker Compose** (or import existing).
2. **Domains**: add `wasup.app` and `www.wasup.app`.
3. **Port**: `3025` (container exposes Next.js on 3025, not 3000).
4. **HTTPS**: enable **Let's Encrypt** / automatic certificate.
5. **Deploy** and wait until **Running**.
6. **Server → Proxy**: ensure Traefik is healthy; do not disable default catchall unless you know the impact.

### API (194.9.62.143)

1. Coolify on `194.9.62.143` → new compose resource for `wa-desk`.
2. **Domain**: `api.wasup.app` only.
3. **Port**: `3025`.
4. Enable **Let's Encrypt** → **Deploy**.

## ACME / 503 troubleshooting

Symptoms: HTTPS **503**, HTTP **404**, apps fine on `:3025`.

- **Cause**: Coolify Traefik catchall (`default_redirect_503.yaml`) has no backend until a router with higher priority exists.
- **Fix**: Traefik labels on the app container + `traefik.docker.network=coolify` + container attached to `coolify` network.
- **ACME "Cannot retrieve challenge"**: ensure port **80** reaches Traefik and an HTTP router exists for the hostname before requesting certs.
- **Rate limits**: failed certs for unrelated domains (e.g. `api.bokily.com`) spam logs; fix or remove broken Coolify domains to reduce noise.

## Re-apply override from repo

Copy override files to the server paths above, then `docker compose up -d --force-recreate` for `wa-front` or `wa-desk`.
