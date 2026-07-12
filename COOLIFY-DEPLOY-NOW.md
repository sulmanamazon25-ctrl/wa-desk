# Deploy now (Plan B split) — Coolify Terminal

SSH from GitHub Actions failed until `FRONT_VPS_SSH_KEY` is set to **`coolify_afanmoviles`** (works on `46.62.226.89`). `euronode_key` does **not** work on either server for automated deploy from PC.

## 1. API — 194.9.62.143 (WhatsApp AI Desk project only)

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/sulmanamazon25-ctrl/wa-desk/master/deploy/wa-desk/coolify-terminal-deploy.sh)"
```

Verify:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3025/api/license/validate
```

Expect **401** or **403** (not 000).

Public: `http://194.9.62.143:3025/api/license/validate`

---

## 2. Frontend — 46.62.226.89 (existing Coolify project)

**Do not create a new project.** Add resource **or** run in Server Terminal:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/sulmanamazon25-ctrl/wa-desk/master/deploy/wa-front/coolify-terminal-deploy.sh)"
```

Verify: `http://46.62.226.89:3025/pricing`

Smoke test from Windows:

```powershell
cd D:\whatsapp-ai-desktop
node scripts/smoke-marketing.mjs http://46.62.226.89:3025
```

---

## 3. Installer on /download

After frontend deploy, copy the built installer into the frontend container **or** rebuild image with `public/release/WhatsApp-AI-Desk-Setup-latest.exe` included:

```powershell
cd D:\whatsapp-ai-desktop
npm run dist:win:split
```

Then redeploy frontend (Docker build picks up `public/release/`).

Download URL defaults to `/release/WhatsApp-AI-Desk-Setup-latest.exe` on the marketing site.

---

## 4. GitHub Actions (optional)

Add the **same private key Coolify uses** as repo secrets:

- `VPS_SSH_KEY` → 194.9.62.143
- `FRONT_VPS_SSH_KEY` → 46.62.226.89

Then: Actions → **Deploy to VPS** / **Deploy frontend to 46.62.226.89** → Run workflow.

---

## 5. wasup.com (when purchased)

See [DOMAIN-WASUP.md](./DOMAIN-WASUP.md).
