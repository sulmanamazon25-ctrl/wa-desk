# Stripe + Resend setup — WhatsApp AI Desk (wasup.app)

All billing and email runs on the **API server** (`194.9.62.143` / `https://api.wasup.app`) — **not** the marketing frontend.

---

## Quick automate (recommended)

### 1. Create local secrets file

```powershell
cd D:\whatsapp-ai-desktop
copy .env.billing.local.example .env.billing.local
notepad .env.billing.local
```

Fill at minimum:

```env
STRIPE_SECRET_KEY=sk_test_...   # or sk_live_...
RESEND_API_KEY=re_...
```

### 2. Create Stripe products + webhook (CLI)

```powershell
npm run setup:stripe
```

This creates:

- **Pro** $29/mo → `STRIPE_PRICE_PRO_MONTHLY`
- **Business** $249/yr → `STRIPE_PRICE_BUSINESS_YEARLY`
- **Lifetime** $499 once → `STRIPE_PRICE_LIFETIME`
- Webhook → `https://api.wasup.app/api/stripe/webhook` (event: `checkout.session.completed`)

Output is written to `.env.billing.local` and `deploy/wa-desk/coolify-env-paste.txt` (gitignored).

### 3. Resend domain (dashboard)

1. [resend.com](https://resend.com) → **Domains** → Add **wasup.app**
2. Add DNS records Resend shows (SPF, DKIM, etc.)
3. After verified, set in `.env.billing.local`:

```env
CONTACT_FROM_EMAIL=WhatsApp AI Desk <hello@wasup.app>
CONTACT_INBOX_EMAIL=support@wasup.app
```

For **testing only**, you can use `onboarding@resend.dev` as FROM (Resend default) — limited to your Resend account email.

### 4. Push env to API server + redeploy

```powershell
npm run deploy:billing-env
```

### 5. Verify

```powershell
npm run verify:billing
```

---

## Manual Stripe (if you prefer dashboard)

### Products

| Name | Price | Type | Env var |
|------|-------|------|---------|
| WhatsApp AI Desk Pro | $29 | Monthly recurring | `STRIPE_PRICE_PRO_MONTHLY` |
| WhatsApp AI Desk Business | $249 | Yearly recurring | `STRIPE_PRICE_BUSINESS_YEARLY` |
| WhatsApp AI Desk Lifetime | $499 | One-time | `STRIPE_PRICE_LIFETIME` |

Copy each **Price ID** (`price_...`).

### Webhook — **do not use Coolify port 8000**

| Field | Value |
|-------|--------|
| URL | `https://api.wasup.app/api/stripe/webhook` |
| Events | **`checkout.session.completed` only** |

Copy **Signing secret** (`whsec_...`) → `STRIPE_WEBHOOK_SECRET`.

### API keys

Developers → API keys → **Secret key** → `STRIPE_SECRET_KEY`

---

## Full API env block (Coolify → wa-desk on 194.9.62.143)

```env
NEXT_PUBLIC_APP_URL=https://wasup.app
DOWNLOAD_URL=https://wasup.app/download
CORS_ALLOWED_ORIGINS=https://wasup.app,https://www.wasup.app

STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_BUSINESS_YEARLY=price_...
STRIPE_PRICE_LIFETIME=price_...

RESEND_API_KEY=re_...
CONTACT_FROM_EMAIL=WhatsApp AI Desk <hello@wasup.app>
CONTACT_INBOX_EMAIL=support@wasup.app
```

Plus existing secrets: `WA_DB_PASSWORD`, `LICENSE_SIGNING_SECRET`, `ADMIN_API_KEY`, `DATABASE_URL`.

---

## Test checkout

1. Stripe **Test mode** ON
2. Open https://wasup.app/pricing → **Buy Pro**
3. Card: `4242 4242 4242 4242`, any future date, any CVC
4. Expect redirect to `/download?checkout=success`
5. Email with `WADESK-...` license key
6. Stripe → Webhooks → endpoint → **200** on `checkout.session.completed`

---

## Go live

1. Stripe → disable Test mode
2. Re-run `npm run setup:stripe` with **live** `sk_live_...` (creates live products + webhook)
3. `npm run deploy:billing-env`
4. Test one real small purchase

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Checkout returns **503** | `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` missing on API server |
| Webhook **400** signature | Wrong `STRIPE_WEBHOOK_SECRET` — use secret from **this** webhook endpoint |
| No license email | `RESEND_API_KEY` missing or domain not verified |
| Contact form **503** | `RESEND_API_KEY` + `CONTACT_INBOX_EMAIL` on API server |
| Webhook URL on `:8000` | Wrong — must be `https://api.wasup.app/api/stripe/webhook` |
