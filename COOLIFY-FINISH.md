# Finish deploy — run this in Coolify Terminal

Open **Coolify** → left sidebar **Terminal** → select server **194.9.62.143** → paste:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/sulmanamazon25-ctrl/wa-desk/master/deploy/wa-desk/coolify-terminal-deploy.sh)"
```

This will:
- Ensure Docker is running
- Clone/update `wa-desk` to `/opt/wa-desk`
- Build the **server-only** image (no Puppeteer/Electron)
- Start isolated Postgres + app on **port 3025**
- Not touch DownItX + Pinquill

---

## After it finishes (your PC)

```powershell
cd D:\whatsapp-ai-desktop
npm run wait:deploy
npm run admin:license -- --email you@example.com --plan lifetime
```

---

## If Coolify resource already exists

You can still run the terminal script — it uses Docker Compose directly on the host (`/opt/wa-desk`), separate from other Coolify projects.

Or update your Coolify compose resource:
- File: `deploy/wa-desk/docker-compose.coolify-ready.yml` (pulls GHCR image)
- Env: `deploy/wa-desk/coolify-env-paste.txt` (local, gitignored)
- Port: **3025**

---

## SSH note

If you use Remote-SSH (`euronode_key`), ensure the public key is in `/root/.ssh/authorized_keys` on the server. Current keys on this PC were rejected.
