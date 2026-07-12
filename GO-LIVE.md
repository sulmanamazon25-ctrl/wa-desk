# Go-live checklist

After local dev verification, complete these in order.

## 1. Windows installer (your PC)

**Stop `npm run dev` first** — `dist:win` runs `next build`, which corrupts a running dev server's `.next` cache.

```bat
cd /d D:\whatsapp-ai-desktop
set DESK_LICENSE_SERVER_URL=https://yourdomain.com
set DESK_UPDATE_URL=https://yourdomain.com/release/
set CSC_IDENTITY_AUTO_DISCOVERY=false
npm run dist:win
```

Output: `release/WhatsApp AI Desk-Setup-0.2.0.exe` (~156 MB)

If electron-builder fails on symlinks, use `signAndEditExecutable: false` (already set) and `CSC_IDENTITY_AUTO_DISCOVERY=false`.

Upload to VPS: `/var/www/whatsapp-ai-desk/release/WhatsApp-AI-Desk-Setup-latest.exe`

## 2. VPS deploy (marketing + API)

1. Copy `.env.production.example` → `.env.production` on the server
2. Fill Stripe, Resend, `LICENSE_SIGNING_SECRET`, `NEXT_PUBLIC_APP_URL`
3. `npm ci && npm run build`
4. Copy static: `cp -r .next/static .next/standalone/.next/static && cp -r public .next/standalone/public`
5. `pm2 start ecosystem.config.cjs` (from repo root)
6. nginx → proxy `127.0.0.1:3000` — see `DEPLOY-VPS.md`

## 3. Stripe

- Create products: Pro ($29/mo), Business ($249/yr), Lifetime ($499 one-time)
- Copy Price IDs into `.env.production`
- Webhook: `https://yourdomain.com/api/stripe/webhook` → `checkout.session.completed`

Test mode: complete a test checkout → license email within ~60s.

## 4. Resend

- Verify sending domain
- Set `CONTACT_FROM_EMAIL` and `CONTACT_INBOX_EMAIL`

## 5. Smoke test

```bash
node scripts/smoke-marketing.mjs https://yourdomain.com
```

## 6. End-to-end client test

1. Download installer from `/download`
2. Install on a clean Windows VM (no Node)
3. Activate license from test purchase email
4. Add OpenRouter key → Save + Test (all green)
5. Connect WhatsApp → Draft queue → Suggest reply

## 7. Optional before ads

- Set `NEXT_PUBLIC_CRISP_WEBSITE_ID` for live chat
- Point `support@yourdomain.com` to your inbox
- Share `docs/CLIENT-SETUP.md` with customers
