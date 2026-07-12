# Finish deploy — wa-desk on port 3025

## Current status (checked)

| Check | Result |
|-------|--------|
| `194.9.62.143:3025` | **Not open** — app not deployed yet |
| `194.9.62.143:3010` | Open (Supabase — do not use) |
| SSH from this PC | **Blocked** — keys not in server `authorized_keys` |
| GitHub Actions deploy | Failed — same SSH auth issue |
| Docker image (GHCR) | Built successfully (private) |

---

## Option A — Coolify resource (recommended if you already added one)

In **WhatsApp AI Desk** project → your Docker Compose resource:

1. **Source** → Public Git: `https://github.com/sulmanamazon25-ctrl/wa-desk`
2. **Branch**: `master`
3. **Compose file**: `deploy/wa-desk/docker-compose.yml`
4. **Environment** — paste from local `deploy/wa-desk/coolify-env-paste.txt`
5. **Ports**: expose **3025** (public)
6. Click **Deploy** / **Redeploy**

Coolify builds on the server (no SSH from your PC needed).

---

## Option B — Coolify Terminal (one line)

Coolify → **Terminal** → paste:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/sulmanamazon25-ctrl/wa-desk/master/deploy/wa-desk/coolify-terminal-deploy.sh)"
```

---

## After deploy succeeds (your PC)

```powershell
cd D:\whatsapp-ai-desktop
npm run wait:deploy
npm run admin:license -- --email you@example.com --plan lifetime
set DESK_LICENSE_SERVER_URL=http://194.9.62.143:3025
npm run dist:win
```

---

## Fix SSH for future (optional)

In Coolify Terminal on the server, add your PC public key:

```bash
mkdir -p ~/.ssh && chmod 700 ~/.ssh
# paste your euronode_key.pub line into authorized_keys
nano ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

Then GitHub Action `Deploy to VPS` will work from Actions tab.
