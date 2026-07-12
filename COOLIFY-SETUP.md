# Coolify setup — safe & isolated (do not touch DownItX + Pinquill)

Your screenshot shows **one existing project**: `DownItX + Pinquill`.  
**Do not** click **+ Add Resource** inside that project for wa-desk.

Create a **separate project** so databases, ports, and env vars never mix.

> **Port warning:** `194.9.62.143:3010` is already used by **Supabase** (Pinquill stack).  
> wa-desk uses **3025** only — never bind 3010 or 8000.

---

## Step 1 — New project (2 minutes)

1. Open Coolify: `http://194.9.62.143:8000/projects`
2. Click the white **+ Add** button next to **Projects** (top right of the projects list)
3. Name: **`WhatsApp AI Desk`**
4. Description: `License API + marketing for wa-desk desktop app`
5. Save

You should now see **two** project cards — DownItX + Pinquill unchanged, WhatsApp AI Desk empty.

---

## Step 2 — Docker Compose resource (recommended)

Inside **WhatsApp AI Desk** project only:

1. **+ Add Resource** → **Docker Compose**
2. **Prefer Git** (required for `wa-desk` build):
   - Connect your `whatsapp-ai-desktop` repository
   - Compose file path: `deploy/wa-desk/docker-compose.yml`
   - Base directory: repository root
3. **Paste-only editor**: paste [`deploy/wa-desk/docker-compose.paste-db-only.yml`](deploy/wa-desk/docker-compose.paste-db-only.yml), deploy Postgres first, then add `wa-desk` as a separate **Application** (Dockerfile `deploy/wa-desk/Dockerfile`, port **3025**).

> Do **not** paste the full stack without Git — the `wa-desk` service must build from your repo.

### Step 2b — After resource is added (do this now)

1. Open the resource → **Environment** tab
2. Paste everything from [`deploy/wa-desk/coolify-env-paste.txt`](deploy/wa-desk/coolify-env-paste.txt) → **Save**
3. **Ports / Domains** → expose **3025** (public) — never 3010 or 8000
4. If using Git compose: confirm compose path `deploy/wa-desk/docker-compose.yml`
5. Click **Deploy** (or **Redeploy**) and wait until status is **Running**
6. Open **Logs** for `wa-desk-app` — look for `Ready on http://0.0.0.0:3025`

From your PC:

```powershell
cd D:\whatsapp-ai-desktop
npm run wait:deploy
```

When that passes, continue to Step 3 below.

### Required environment variables

Copy from [`deploy/wa-desk/.env.example`](deploy/wa-desk/.env.example) into Coolify **Environment** tab.

Generate strong secrets locally:

```powershell
npm run gen:coolify-secrets
```

| Variable | Notes |
|----------|--------|
| `WA_DB_PASSWORD` | Strong random — Postgres only for wa_desk |
| `LICENSE_SIGNING_SECRET` | 32+ char random |
| `ADMIN_API_KEY` | Same value you put in local `.env.admin.local` |
| `NEXT_PUBLIC_APP_URL` | `http://194.9.62.143:3025` |
| Stripe / Resend | Add when ready for live billing |

### Port

- Exposed: **3025** → `194.9.62.143:3025`
- **Do not** use 8000 (Coolify UI) or ports used by pinquill/downitx

### Deploy

Click **Deploy**. Coolify will:

- Create volume `wa_desk_pgdata` (isolated)
- Create network `wa_desk_net` (isolated)
- Start `wa-desk-postgres` (no public port)
- Build and start `wa-desk-app` on port 3025

Schema auto-creates on first license API call (`ensureLicenseSchema`).

---

## Step 3 — Verify (from your PC)

```powershell
cd D:\whatsapp-ai-desktop
node scripts/smoke-marketing.mjs http://194.9.62.143:3025
```

Expect all marketing routes **200**. Stripe checkout may return **503** until keys are set — that's OK.

---

## Step 4 — Admin license (local machine)

```powershell
copy .env.admin.local.example .env.admin.local
notepad .env.admin.local
# Set ADMIN_API_KEY to match Coolify
# Set WA_DESK_SERVER_URL=http://194.9.62.143:3025

npm run admin:license -- --email you@example.com --plan lifetime
```

Save the printed `WADESK-...` key for your desktop app.

---

## Step 5 — Desktop app

After the server is live on **3025**, rebuild the Windows installer so licenses hit the correct URL:

```powershell
set DESK_LICENSE_SERVER_URL=http://194.9.62.143:3025
npm run dist:win
```

- Install `release\WhatsApp AI Desk-Setup-*.exe`
- App opens **dashboard** first
- **3-day trial** for WhatsApp Connect
- After trial → license modal on Connect

---

## Safety checklist

| Risk | Mitigation |
|------|------------|
| Shared Postgres with pinquill | **New** `wa-db` container + `wa_desk` database only |
| Port conflict | **3025** only — 3010 is Supabase; 8000 is Coolify |
| Wrong project | New **WhatsApp AI Desk** project, not DownItX |
| Secret leak | Env only in Coolify + local `.env.admin.local` (gitignored) |
| Breaking other apps | No edits to DownItX + Pinquill resources |

---

## Alternative: manual two resources

If you prefer not to use Docker Compose, see [DEPLOY-COOLIFY.md](DEPLOY-COOLIFY.md) — still use the **WhatsApp AI Desk** project, not DownItX.
