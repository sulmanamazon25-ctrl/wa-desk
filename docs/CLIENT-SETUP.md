# Client setup — WhatsApp AI Desk

Five steps from download to first AI-suggested reply.

## 1. Download and install

1. Go to your vendor download page (e.g. `https://yourdomain.com/download`).
2. Run **WhatsApp AI Desk Setup** (Windows `.exe`).
3. Launch from Start Menu or desktop shortcut.

No Node.js or npm is required.

## 2. Activate license (when connecting WhatsApp)

After the **3-day trial**, or if you purchased a license:

1. Go to **Connect** in the sidebar
2. Click **Show QR code** — the license modal appears if trial ended
3. Paste the key from your purchase email (`WADESK-XXXX-XXXX-XXXX`)
4. Click **Activate license**, then connect again

The app opens the **dashboard** on launch — no license screen at startup.

## 3. Connect WhatsApp

1. Go to **Connect** in the sidebar.
2. Scan the QR code with WhatsApp → Linked devices, **or** use phone pairing (8-digit code).
3. Wait until status shows connected.

Use a **dedicated business number** when possible. See [Acceptable Use](/acceptable-use) on the marketing site.

## 4. OpenRouter API key

1. Create an account at [OpenRouter](https://openrouter.ai/) and add billing credits.
2. In the desk: **Setup → API keys**.
3. Paste your OpenRouter key.
4. Click **Save**, then **Test** — all checks should be green.

You pay OpenRouter directly for AI usage (BYOK). We do not mark up API costs.

## 5. Training and inbox

1. **Setup → Training** — paste business FAQ, hours, tone, and policies.
2. **Inbox** — select a chat.
3. Set reply mode to **Draft queue** (recommended for first tests).
4. Send yourself a test message (or receive a customer message).
5. Click **Suggest reply** — review the draft, then **Send to WhatsApp** if it looks good.

### Voice notes

Install ffmpeg if voice transcription fails:

```powershell
winget install Gyan.FFmpeg
```

Then re-test API keys and try an inbound voice note from a customer.

## Support

- Marketing site: `/support` (FAQ + Crisp chat if enabled)
- Email: contact form on `/contact`
- In-app: sidebar **Support** link (opens browser)

## Troubleshooting

| Issue | Fix |
|-------|-----|
| License server error | Check internet; vendor must set `DESK_LICENSE_SERVER_URL` in the desktop build |
| OpenRouter Test fails | Verify key, credits, and model names in Setup |
| WhatsApp won't connect | Run `npm run setup:chrome` (dev) or install Chrome/Edge; see Connect panel hints |
| License on wrong PC | Email support for transfer |
