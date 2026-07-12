# Deploy WhatsApp AI Desk on Coolify (194.9.62.143)

> **Start here:** [COOLIFY-SETUP.md](COOLIFY-SETUP.md) — step-by-step with screenshots.  
> **Important:** create a **new** project `WhatsApp AI Desk`. Do **not** add resources inside `DownItX + Pinquill`.

Port **8000** is the **Coolify dashboard**. The app runs on **3025** only.

**Fast path:** use the isolated stack in [`deploy/wa-desk/docker-compose.yml`](deploy/wa-desk/docker-compose.yml) (own Postgres volume + network).

---

## Manual two-resource setup (alternative)

In Coolify → **+ New Resource** → **Database** → PostgreSQL:

| Setting | Value |
|---------|--------|
| Name | `wa-db` |
| Database | `wa_desk` |
| User | `wa_desk` |
| Password | strong random (save in Coolify) |
| Public port | **off** (internal only) |

Note the **internal connection string** Coolify shows, e.g.:

```text
postgresql://wa_desk:PASSWORD@wa-db:5432/wa_desk
```

Run migration once (from your PC with DB tunnel, or Coolify terminal):

```bash
psql "$DATABASE_URL" -f migrations/001_licenses.sql
```

Or let the app auto-create schema on first request (`ensureLicenseSchema`).

## 2. Application `wa-desk`

**+ New Resource** → **Application** → Git / Docker:

| Setting | Value |
|---------|--------|
| Name | `wa-desk` |
| Port | **3025** |
| Domain | `http://194.9.62.143:3025` (or subdomain later) |
| Build | `npm ci && npm run build` |
| Start | `node .next/standalone/server.js` |
| Working dir | copy static after build (see below) |

### Post-build copy (Coolify build command or start script)

```bash
npm ci
npm run build
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
cd .next/standalone && node server.js
```

### Environment variables

```env
NODE_ENV=production
PORT=3025
HOSTNAME=0.0.0.0
NEXT_PUBLIC_APP_URL=http://194.9.62.143:3025

DATABASE_URL=postgresql://wa_desk:PASSWORD@wa-db:5432/wa_desk
LICENSE_SIGNING_SECRET=<long-random>
ADMIN_API_KEY=<long-random-for-admin-script>

STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_BUSINESS_YEARLY=price_...
STRIPE_PRICE_LIFETIME=price_...

RESEND_API_KEY=re_...
CONTACT_FROM_EMAIL=WhatsApp AI Desk <hello@yourdomain.com>
CONTACT_INBOX_EMAIL=support@yourdomain.com
DOWNLOAD_URL=http://194.9.62.143:3025/download
```

Link `wa-desk` to `wa-db` network in Coolify so `DATABASE_URL` host `wa-db` resolves.

## 3. Stripe webhook

URL: `http://194.9.62.143:3025/api/stripe/webhook`  
Event: `checkout.session.completed`

## 4. Desktop installer points here

When building the Windows `.exe`:

```bat
set DESK_LICENSE_SERVER_URL=http://194.9.62.143:3025
npm run dist:win
```

## 5. Admin license (your machine)

```bat
copy .env.admin.local.example .env.admin.local
notepad .env.admin.local
npm run admin:license -- --email you@example.com --plan lifetime
```

## 6. Isolation checklist

- [ ] `wa-db` is a **new** Postgres container (not pinquill/downitx DB)
- [ ] `wa-desk` uses port **3025**, not 8000
- [ ] No env vars shared with other Coolify apps
- [ ] Smoke test: `node scripts/smoke-marketing.mjs http://194.9.62.143:3025`

## 7. Client flow (after installer update)

1. App opens **dashboard** immediately (no license screen)
2. **3-day trial** — Connect WhatsApp works without key
3. After trial — Connect shows license modal
4. Stripe purchase emails `WADESK-...` key; user activates in modal
