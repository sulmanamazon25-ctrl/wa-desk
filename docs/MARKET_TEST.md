# Market test checklist — WhatsApp AI Desk (MVP)

Use this for a **1–2 week** beta with 5–15 real users (small business owners who live in WhatsApp).

## Who to recruit

- Replies to **many** WhatsApp leads daily (shop, clinic, agency, freelancer).
- Mix of **Urdu / English / Roman Urdu** is ideal.
- At least a few users on **Windows desktop** (this build is Electron-first).

## What to prove (success = “I’d pay for this”)

| Area | Test | Pass signal |
|------|------|----------------|
| **Voice inbound** | Customer sends 10–30s voice notes | AI suggest / auto reply reflects **actual words**, not generic “I’ll listen” unless STT truly failed |
| **Manual suggest** | Tap **AI suggestion** after voice-heavy thread | Variants feel **on-topic** and same language as customer |
| **Draft vs auto** | Switch modes + optional **Selective** per chat | No accidental sends; drafts land in dock; selective routes match expectation |
| **Mic send** | Record **voice reply** from app | Message appears as **voice note** in WhatsApp on phone |
| **Scroll / UX** | Long group threads | **↑ ↓** buttons make reading comfortable without rage-quitting |

## Session script (15 min)

1. Connect WhatsApp (QR). Enable notifications when prompted.
2. Pick **Selective** → set 2 chats **Auto**, 1 **Draft**, rest **Off**.
3. Open a chat with **voice notes** → **AI suggestion** → pick a variant → send manually.
4. Record a **short voice reply** (mic) → confirm on phone.
5. Stress: **switch chats** while composer has text — field should **not** carry old text.

## Instrumentation (lightweight)

- Log or note: **STT failures** (empty transcript) vs provider (xAI vs Groq).
- Count: **suggestions per day**, **edits before send**, **auto-replies sent** vs mistakes (user report).

## Pricing / packaging hypotheses to validate

- **Seat**: one desktop + one WhatsApp number vs multi-account add-on.
- **Tier**: “AI suggest only” vs “Auto-send” vs “Team inbox (future)”.
- **Risk**: users fear wrong auto-send → **Draft + Selective** is the safe default story.

## Exit criteria for “go wider”

- ≥70% of beta users say **suggestions save time weekly**.
- No **P0** bugs (wrong chat send, credential leak, session wipe without warning).
- Voice STT “good enough” on **their** accents/languages or clear workaround (Groq backup key).

---

*Internal doc — adjust numbers and tiers before external beta agreement.*
