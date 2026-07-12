# Finish deploy — WhatsApp AI Desk on Coolify (2 minutes)

Repo: **https://github.com/sulmanamazon25-ctrl/wa-desk** (private)

GitHub Actions builds the Docker image automatically → `ghcr.io/sulmanamazon25-ctrl/wa-desk:latest`

---

## Option A — Paste compose (easiest, no Git in Coolify)

1. Open your **WhatsApp AI Desk** resource in Coolify
2. **Replace** the Docker Compose editor content with the file:
   `deploy/wa-desk/docker-compose.coolify-ready.yml` from the repo
3. **Environment** → paste from your local `deploy/wa-desk/coolify-env-paste.txt`
   (if missing: `copy deploy\wa-desk\coolify-env-paste.example.txt deploy\wa-desk\coolify-env-paste.txt` and fill secrets)
4. **Ports** → **3025** public
5. **Deploy** / **Redeploy**
6. Wait for GitHub Actions to finish first (image must exist):  
   https://github.com/sulmanamazon25-ctrl/wa-desk/actions

---

## Option B — Git source in Coolify

| Field | Value |
|-------|--------|
| Repository | `https://github.com/sulmanamazon25-ctrl/wa-desk` |
| Branch | `master` |
| Compose file | `deploy/wa-desk/docker-compose.yml` |
| Base directory | `/` (repo root) |

Add Coolify deploy key to GitHub repo → Settings → Deploy keys.

Same env vars + port **3025** → Deploy.

---

## Verify (your PC)

```powershell
cd D:\whatsapp-ai-desktop
npm run wait:deploy
npm run admin:license -- --email you@example.com --plan lifetime
```

---

## Desktop installer

```powershell
set DESK_LICENSE_SERVER_URL=http://194.9.62.143:3025
npm run dist:win
```

---

## Safety

- Project: **WhatsApp AI Desk** only (not DownItX + Pinquill)
- Port: **3025** only (3010 = Supabase, 8000 = Coolify)
