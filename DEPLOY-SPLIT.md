# Plan B — split deploy (website + API on separate servers)

## Architecture

| Server | Role | Compose | Port |
|--------|------|---------|------|
| **46.62.226.89** | Marketing site only | `deploy/wa-front/docker-compose.yml` | 3025 |
| **194.9.62.143** | API + Postgres | `deploy/wa-desk/docker-compose.yml` | 3025 |

Final domains: `wasup.app` (front) · `api.wasup.app` (API)

---

## 1. Deploy API first (194.9.62.143)

Coolify → **WhatsApp AI Desk** project (not DownItX + Pinquill):

- Git: `https://github.com/sulmanamazon25-ctrl/wa-desk`
- Compose: `deploy/wa-desk/docker-compose.yml`
- Env: `deploy/wa-desk/coolify-env-paste.example.txt` (+ your secrets)
- **Required for split:** `CORS_ALLOWED_ORIGINS`, `NEXT_PUBLIC_APP_URL=https://wasup.app`
- Port **3025** public

**Or Terminal on 194.9.62.143:**

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/sulmanamazon25-ctrl/wa-desk/master/deploy/wa-desk/coolify-terminal-deploy.sh)"
```

Verify: `curl -s -o /dev/null -w "%{http_code}" http://194.9.62.143:3025/api/license/validate` → 401/403

---

## 2. Deploy frontend (46.62.226.89 — existing project)

**Do not create a new project.** Inside your existing Coolify project:

- **+ Add Resource** → Docker Compose
- Git: `https://github.com/sulmanamazon25-ctrl/wa-desk`
- Compose: `deploy/wa-front/docker-compose.yml`
- Env: `deploy/wa-front/coolify-env-paste.example.txt`
- Port **3025** public

**Or Terminal on 46.62.226.89:**

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/sulmanamazon25-ctrl/wa-desk/master/deploy/wa-front/coolify-terminal-deploy.sh)"
```

Verify: `http://46.62.226.89:3025/pricing`

Smoke test from PC:

```powershell
cd D:\whatsapp-ai-desktop
node scripts/smoke-marketing.mjs http://46.62.226.89:3025
```

---

## 3. wasup.app + SSL

| DNS | Points to | Notes |
|-----|-----------|-------|
| `A` `@` | `46.62.226.89` | Apex / frontend |
| `CNAME` `www` | `wasup.app` | www subdomain |
| `A` `api` | `194.9.62.143` | API subdomain |

Coolify SSL: see [DOMAIN-WASUP.md](./DOMAIN-WASUP.md) for step-by-step (add `wasup.app` + `www.wasup.app` on frontend; `api.wasup.app` on API).

**Frontend env (46.62):**

```env
NEXT_PUBLIC_APP_URL=https://wasup.app
NEXT_PUBLIC_API_ORIGIN=https://api.wasup.app
NEXT_PUBLIC_DOWNLOAD_URL=https://wasup.app/download
```

**API env (194.9):**

```env
NEXT_PUBLIC_APP_URL=https://wasup.app
DOWNLOAD_URL=https://wasup.app/download
CORS_ALLOWED_ORIGINS=https://wasup.app,https://www.wasup.app
```

Redeploy both.

**Stripe webhook:** `https://api.wasup.app/api/stripe/webhook` (event: `checkout.session.completed`)

---

## 4. Desktop installer

```powershell
set DESK_LICENSE_SERVER_URL=https://api.wasup.app
set DESK_MARKETING_ORIGIN=https://wasup.app
npm run dist:win
```

Upload `release\WhatsApp AI Desk-Setup-*.exe` to frontend `/download` path.

---

## Safety

- Never use port **8000** (Coolify UI) or **3010** (Supabase) for wa-desk
- Frontend server has **no** Postgres or Stripe secrets
- Do not add wa-desk to **DownItX + Pinquill** project
