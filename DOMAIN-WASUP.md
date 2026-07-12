# wasup.com — domain + Stripe HTTPS (Plan B split deploy)

## DNS (at your registrar)

| Type | Host | Value |
|------|------|-------|
| A | `@` | `46.62.226.89` |
| A | `api` | `194.9.62.143` |

Wait 5–30 minutes for propagation.

## Coolify SSL

**46.62.226.89** (frontend resource): add domain `wasup.com` → enable Let's Encrypt  
**194.9.62.143** (API resource): add domain `api.wasup.com` → enable Let's Encrypt

## Update env and redeploy both

**Frontend** (`deploy/wa-front/coolify-env-paste.example.txt`):

```env
NEXT_PUBLIC_APP_URL=https://wasup.com
NEXT_PUBLIC_API_ORIGIN=https://api.wasup.com
NEXT_PUBLIC_DOWNLOAD_URL=https://wasup.com/download
```

**API** (`deploy/wa-desk/coolify-env-split-api.example.txt`):

```env
NEXT_PUBLIC_APP_URL=https://wasup.com
DOWNLOAD_URL=https://wasup.com/download
CORS_ALLOWED_ORIGINS=https://wasup.com
```

## Stripe

- Webhook URL: `https://api.wasup.com/api/stripe/webhook`
- Event: `checkout.session.completed`
- Copy `whsec_...` → API Coolify `STRIPE_WEBHOOK_SECRET`

## Desktop installer

```powershell
set DESK_LICENSE_SERVER_URL=https://api.wasup.com
set DESK_MARKETING_ORIGIN=https://wasup.com
npm run dist:win
```
