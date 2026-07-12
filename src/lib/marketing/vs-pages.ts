export type VsSlug = "wati" | "respond-io" | "interakt";

export type ComparisonRow = {
  feature: string;
  desk: { ok: boolean; text: string };
  them: { ok: boolean; text: string };
};

export type VsPageData = {
  slug: VsSlug;
  competitor: string;
  title: string;
  subtitle: string;
  whoDesk: string;
  whoThem: string;
  rows: ComparisonRow[];
  chooseThem: string[];
  chooseDesk: string[];
  pricingNote: string;
};

const BASE_ROWS: ComparisonRow[] = [
  { feature: "Runs on", desk: { ok: true, text: "Your Windows PC" }, them: { ok: true, text: "Vendor cloud" } },
  {
    feature: "WhatsApp connect",
    desk: { ok: true, text: "QR / pairing (minutes)" },
    them: { ok: true, text: "Meta API onboarding (days/weeks)" },
  },
  {
    feature: "AI cost model",
    desk: { ok: true, text: "BYOK OpenRouter (transparent)" },
    them: { ok: false, text: "Bundled credits / markup" },
  },
  {
    feature: "Reply model",
    desk: { ok: true, text: "Draft queue — you approve" },
    them: { ok: false, text: "Often full auto-reply bots" },
  },
  {
    feature: "Chat data",
    desk: { ok: true, text: "Local session on your PC" },
    them: { ok: false, text: "Stored on vendor servers" },
  },
  {
    feature: "Pricing",
    desk: { ok: true, text: "Software license + your AI key" },
    them: { ok: false, text: "Per-seat / per-message SaaS" },
  },
  {
    feature: "Team inbox / CRM",
    desk: { ok: false, text: "Single desk (1 WhatsApp session)" },
    them: { ok: true, text: "Multi-agent, integrations" },
  },
];

export const VS_PAGES: Record<VsSlug, VsPageData> = {
  wati: {
    slug: "wati",
    competitor: "Wati",
    title: "WhatsApp AI Desk vs Wati",
    subtitle:
      "Wati is a cloud WhatsApp marketing and inbox platform. WhatsApp AI Desk is a local desktop assistant — different category, different tradeoffs.",
    whoDesk:
      "Solo operators and small teams who run WhatsApp from their PC and want AI draft replies without a monthly platform stack.",
    whoThem:
      "Teams that need cloud broadcasts, CRM integrations, and official WhatsApp Business API workflows at scale.",
    rows: [
      ...BASE_ROWS,
      {
        feature: "Broadcasts / campaigns",
        desk: { ok: false, text: "Not included (inbox focus)" },
        them: { ok: true, text: "Core product strength" },
      },
      {
        feature: "Setup time",
        desk: { ok: true, text: "Install + QR in minutes" },
        them: { ok: false, text: "API verification + onboarding" },
      },
    ],
    chooseThem: [
      "You need WhatsApp broadcast campaigns and marketing automation",
      "You want a cloud team inbox with CRM hooks",
      "You are ready for Meta Business API compliance workflow",
    ],
    chooseDesk: [
      "You reply from one PC on the number customers already use",
      "You want transparent BYOK AI costs, not bundled credits",
      "You prefer reviewing every AI reply before it goes out",
    ],
    pricingNote:
      "Wati typically charges per-seat platform fees plus message/API costs. Desk charges a software license; you pay OpenRouter separately for AI usage.",
  },
  "respond-io": {
    slug: "respond-io",
    competitor: "Respond.io",
    title: "WhatsApp AI Desk vs Respond.io",
    subtitle:
      "Respond.io is an omnichannel team inbox. WhatsApp AI Desk is a single-operator desktop copilot — not a replacement for enterprise routing.",
    whoDesk:
      "One person (or a small team sharing one PC session) who wants AI-assisted replies on business WhatsApp.",
    whoThem:
      "Growing teams that need multi-channel inbox, agent assignment, workflows, and official API integrations.",
    rows: [
      ...BASE_ROWS,
      {
        feature: "Omnichannel (IG, FB, etc.)",
        desk: { ok: false, text: "WhatsApp only" },
        them: { ok: true, text: "Multi-channel inbox" },
      },
      {
        feature: "Agent assignment",
        desk: { ok: false, text: "Single operator desk" },
        them: { ok: true, text: "Team routing & roles" },
      },
    ],
    chooseThem: [
      "You need multiple agents, channels, and workflow automation in the cloud",
      "You want official API integrations with Salesforce, HubSpot, etc.",
      "You are scaling support beyond one WhatsApp session",
    ],
    chooseDesk: [
      "You personally handle WhatsApp sales/support from your PC",
      "You want local session control and BYOK AI pricing",
      "You need to start today without API project setup",
    ],
    pricingNote:
      "Respond.io is priced as a team platform per seat. Desk is a desktop software license with separate OpenRouter usage.",
  },
  interakt: {
    slug: "interakt",
    competitor: "Interakt",
    title: "WhatsApp AI Desk vs Interakt",
    subtitle:
      "Interakt targets SMB WhatsApp automation and chatbot flows. WhatsApp AI Desk targets assisted replies with human approval on your desktop.",
    whoDesk:
      "Small business owners who want AI help writing replies — not a chatbot that talks to customers without you.",
    whoThem:
      "SMBs that want automated chatbot journeys, catalog flows, and cloud-managed WhatsApp automation.",
    rows: [
      ...BASE_ROWS,
      {
        feature: "Chatbot / flow builder",
        desk: { ok: false, text: "FAQ training + AI suggest" },
        them: { ok: true, text: "Visual automation flows" },
      },
      {
        feature: "Catalog / commerce",
        desk: { ok: false, text: "Not included" },
        them: { ok: true, text: "WhatsApp commerce features" },
      },
    ],
    chooseThem: [
      "You want automated chatbot sequences and drip campaigns",
      "You need WhatsApp catalog and commerce integrations",
      "You prefer a cloud dashboard over a desktop app",
    ],
    chooseDesk: [
      "You want to stay in the loop on every customer message",
      "You run WhatsApp from your PC and want voice-note transcription + drafts",
      "You prefer a one-time Lifetime license option ($499)",
    ],
    pricingNote:
      "Interakt uses subscription tiers with platform features and usage limits. Desk sells software licenses; AI usage is pay-as-you-go via OpenRouter.",
  },
};

export function getVsPage(slug: VsSlug): VsPageData {
  return VS_PAGES[slug];
}
