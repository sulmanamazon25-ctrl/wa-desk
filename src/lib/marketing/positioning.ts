export const POSITIONING = {
  tagline: "AI inbox for WhatsApp — on your PC, with your key, under your control.",
  eyebrow: "Local-first · BYOK · Human-approved",
  heroTitle: "Your WhatsApp copilot — not another chatbot platform",
  heroLead:
    "A desktop assistant for business WhatsApp: AI suggests replies from your FAQs, you approve before sending. Install on your PC, add your OpenRouter key — chats and keys stay on your machine.",
} as const;

export const PILLARS = [
  {
    id: "local",
    title: "Local-first",
    body: "WhatsApp session data stays on your PC. We only store license email and metadata on our server.",
  },
  {
    id: "byok",
    title: "BYOK (OpenRouter)",
    body: "One API key for chat and voice STT. AI usage bills to your OpenRouter account — we do not mark it up.",
  },
  {
    id: "draft",
    title: "Human-in-the-loop",
    body: "Draft queue mode: AI reads each message and suggests a reply. Nothing sends until you approve.",
  },
] as const;

export const ICP_CARDS = [
  {
    title: "Freelancers & agencies",
    body: "One desk per operator. Lifetime license fits agencies standardizing on a single Windows workflow.",
  },
  {
    title: "Local services",
    body: "Clinics, salons, tutors, real estate — reply faster on the number customers already use.",
  },
  {
    title: "Privacy-sensitive operators",
    body: "Consultants and professionals who want AI help without handing chat history to a cloud vendor.",
  },
] as const;

export const NOT_FOR_YOU = [
  "Multi-agent team inbox with CRM and routing",
  "Official Meta WhatsApp Business API at enterprise scale",
  "Fully autonomous bots with no human review",
] as const;

export const FEATURES = [
  {
    title: "Inbox + draft queue",
    body: "AI suggests replies; you review before send. Safe default for customer-facing teams.",
  },
  {
    title: "Voice notes → text",
    body: "Transcribe inbound voice messages via OpenRouter STT so AI can reply with context.",
  },
  {
    title: "Training bundle",
    body: "Paste FAQs, policies, and tone — the model follows your business, not generic chatbot fluff.",
  },
  {
    title: "One OpenRouter key",
    body: "Chat and speech-to-text through a single BYOK key. Usage bills to your OpenRouter account.",
  },
  {
    title: "Local sessions",
    body: "WhatsApp session data stays on the PC. We only store license email + metadata on our server.",
  },
  {
    title: "Windows installer",
    body: "One-click NSIS setup. No Node.js or npm required for your clients.",
  },
] as const;

export const SETUP_STEPS = [
  "Download and install the Windows app",
  "Activate your license key from email",
  "Connect WhatsApp (QR or pairing code)",
  "Setup → API keys → OpenRouter → Save + Test",
  "Training → paste FAQ → Inbox in Draft queue mode",
] as const;

export const COST_COMPARISON = {
  desk: {
    label: "WhatsApp AI Desk",
    items: ["$29/mo software license (Pro)", "~$5–20/mo OpenRouter (your usage)", "No per-message platform fees"],
  },
  cloud: {
    label: "Typical cloud WhatsApp SaaS",
    items: ["$49–99+/mo per seat", "Bundled or marked-up AI credits", "Meta API setup + message fees"],
  },
} as const;

export const VS_LINKS = [
  { href: "/vs/wati", label: "vs Wati" },
  { href: "/vs/respond-io", label: "vs Respond.io" },
  { href: "/vs/interakt", label: "vs Interakt" },
] as const;

export const HOW_IT_WORKS_STEPS = [
  {
    step: 1,
    title: "Install on Windows",
    body: "Download the NSIS installer. No Node.js or npm. One-click setup on your PC.",
  },
  {
    step: 2,
    title: "Activate license",
    body: "Paste the key from your purchase email when prompted (after trial, on Connect).",
  },
  {
    step: 3,
    title: "Connect WhatsApp",
    body: "Scan QR or use phone pairing. Use a dedicated business number when possible.",
  },
  {
    step: 4,
    title: "Add OpenRouter key",
    body: "Setup → API keys → paste key → Save + Test until all checks are green. You pay OpenRouter directly.",
  },
  {
    step: 5,
    title: "Train + draft queue",
    body: "Paste FAQs in Training. Set Inbox to Draft queue. AI suggests — you approve before send.",
  },
] as const;
