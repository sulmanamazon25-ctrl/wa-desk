# Deploy marketing + billing API on your VPS

This repo serves **two roles**:

1. **Desktop** — Electron + bundled Next standalone (built with `npm run dist:win`).
2. **Server** — Same Next.js app deployed to your VPS for marketing pages, Stripe, licenses, and Resend email.

Only deploy the **web/API** half on the VPS. Clients install the `.exe` from `/download`.

## Prerequisites

- Ubuntu/Debian VPS (or similar) with Node 20+
- Domain + nginx + TLS (Let's Encrypt)
- Stripe account with Products/Prices for `pro`, `business`, `lifetime`
- Resend account with verified sending domain

## 1. Build on the server (or CI)

```bash
git clone <your-repo> whatsapp-ai-desk
cd whatsapp-ai-desk
cp .env.production.example .env.production
# edit .env.production — see below
npm ci
npm run build
```

Copy static assets for standalone:

```bash
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
```

## 2. Environment (`.env.production`)

```env
NEXT_PUBLIC_APP_URL=https://yourdomain.com
LICENSE_SIGNING_SECRET=<long-random-secret>
LICENSE_DB_DIR=/var/lib/whatsapp-ai-desk

STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_BUSINESS_YEARLY=price_...
STRIPE_PRICE_LIFETIME=price_...

RESEND_API_KEY=re_...
CONTACT_FROM_EMAIL=WhatsApp AI Desk <hello@yourdomain.com>
CONTACT_INBOX_EMAIL=support@yourdomain.com

DOWNLOAD_URL=https://yourdomain.com/release/WhatsApp-AI-Desk-Setup-latest.exe
NEXT_PUBLIC_CRISP_WEBSITE_ID=          # optional
```

Create data directory:

```bash
sudo mkdir -p /var/lib/whatsapp-ai-desk
sudo chown $USER:$USER /var/lib/whatsapp-ai-desk
```

License records are stored in `LICENSE_DB_DIR/licenses.json`.

## 3. PM2

```bash
npm install -g pm2
cd .next/standalone
PORT=3000 HOSTNAME=127.0.0.1 pm2 start server.js --name whatsapp-ai-desk
pm2 save
pm2 startup
```

Load env from file:

```bash
pm2 start server.js --name whatsapp-ai-desk --update-env --env production
# Or use ecosystem.config.js with env_file
```

## 4. nginx

```nginx
server {
  listen 443 ssl http2;
  server_name yourdomain.com;

  ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /release/ {
    alias /var/www/whatsapp-ai-desk/release/;
    add_header Content-Disposition 'attachment';
  }
}
```

Host installer at `/var/www/whatsapp-ai-desk/release/WhatsApp-AI-Desk-Setup-latest.exe`.

## 5. Stripe webhook

In Stripe Dashboard → Developers → Webhooks:

- URL: `https://yourdomain.com/api/stripe/webhook`
- Events: `checkout.session.completed` (add `invoice.payment_failed` later for dunning)

## 6. Desktop build points at your server

When building the Windows installer, set in `.env` or build env:

```env
DESK_LICENSE_SERVER_URL=https://yourdomain.com
DESK_UPDATE_URL=https://yourdomain.com/release/
```

Then:

```bash
npm run dist:win
```

Upload `release/WhatsApp AI Desk-Setup-x.y.z.exe` to your VPS `/release/` path.

## Health check

```bash
curl -s https://yourdomain.com/api/license/validate
# 405 or JSON — route exists
curl -s -o /dev/null -w "%{http_code}" https://yourdomain.com/pricing
# 200
```

## Security notes

- Never commit `.env.production` or real Stripe/Resend keys.
- `LICENSE_SIGNING_SECRET` must match between server and any future token validation.
- Back up `LICENSE_DB_DIR/licenses.json` regularly.
