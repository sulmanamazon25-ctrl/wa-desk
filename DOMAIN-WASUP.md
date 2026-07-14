# wasup.app — domain + Stripe HTTPS (Plan B split deploy)

## DNS (at your registrar)

| Type | Host | Value | Status |
|------|------|-------|--------|
| A | `@` | `46.62.226.89` | ✅ Set (frontend) |
| CNAME | `www` | `wasup.app` | ✅ Correct — `www.wasup.app` resolves to the same IP as apex |
| A | `api` | `194.9.62.143` | ⚠️ **Still needed** (API subdomain) |

**www CNAME note:** `www → wasup.app` is the recommended setup (not `www → @`). Both apex and www must be added in Coolify for separate Let's Encrypt certs.

Wait 5–30 minutes after adding `api` for propagation.

---

## Coolify SSL — exact steps

### Frontend — 46.62.226.89 (wa-front resource)

1. Open Coolify → server **46.62.226.89** → your existing project → **wa-front** Docker Compose resource.
2. Go to **Domains** (or **General → Domains**).
3. Add domain: `wasup.app` → Save.
4. Add domain: `www.wasup.app` → Save.
5. For each domain, enable **Let's Encrypt** / **Generate certificate** (HTTPS).
6. Ensure the resource exposes port **3025** (or the proxy maps 443 → 3025).
7. Wait for certificates to show **Valid** (can take 1–5 minutes after DNS propagates).
8. Update env (see below) → **Redeploy** the resource.

### API — 194.9.62.143 (wa-desk resource, after API deploy + `api` DNS)

1. Open Coolify → server **194.9.62.143** → **WhatsApp AI Desk** project → **wa-desk** resource.
2. Go to **Domains**.
3. Add domain: `api.wasup.app` → Save.
4. Enable **Let's Encrypt** for `api.wasup.app`.
5. Update API env (see below) → **Redeploy**.

**Verify SSL:**

```bash
curl -I https://wasup.app
curl -I https://www.wasup.app
curl -I https://api.wasup.app/api/license/validate
```

---

## Update env and redeploy both

**Frontend** (`deploy/wa-front/.env` or Coolify Environment):

```env
NEXT_PUBLIC_APP_URL=https://wasup.app
NEXT_PUBLIC_API_ORIGIN=https://api.wasup.app
NEXT_PUBLIC_DOWNLOAD_URL=https://wasup.app/download
```

**API** (`deploy/wa-desk/.env` or Coolify Environment):

```env
NEXT_PUBLIC_APP_URL=https://wasup.app
DOWNLOAD_URL=https://wasup.app/download
CORS_ALLOWED_ORIGINS=https://wasup.app,https://www.wasup.app
```

Redeploy **both** resources after changing env (frontend rebuilds `NEXT_PUBLIC_*` at build time).

---

## Stripe

- Webhook URL: `https://api.wasup.app/api/stripe/webhook`
- Event: `checkout.session.completed`
- Copy `whsec_...` → API Coolify `STRIPE_WEBHOOK_SECRET`

---

## Desktop installer

```powershell
set DESK_LICENSE_SERVER_URL=https://api.wasup.app
set DESK_MARKETING_ORIGIN=https://wasup.app
npm run dist:win
```

Or use the preset script:

```powershell
npm run dist:win:split
```
