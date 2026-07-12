import OpenAI from "openai";
import { normalizeXaiApiKey } from "../lib/xai-key";
import { loadSecrets } from "./secrets-store";

const XAI_BASE_URL = "https://api.x.ai/v1";

/** Tried in order when `XAI_IMAGE_MODEL` / `XAI_IMAGE_MODEL_LIST` are unset (xAI naming changes by tier). */
const DEFAULT_XAI_IMAGE_MODELS = [
  "grok-imagine-image-quality",
  "grok-2-image",
  "grok-imagine-image-pro",
] as const;

async function resolveXaiApiKey(): Promise<string | undefined> {
  const disk = await loadSecrets();
  const fromDisk = normalizeXaiApiKey(disk.xaiApiKey);
  if (fromDisk) {
    process.env.XAI_API_KEY = fromDisk;
    return fromDisk;
  }
  return normalizeXaiApiKey(process.env.XAI_API_KEY);
}

function parseImageModelList(raw: string | undefined): string[] | null {
  if (!raw?.trim()) return null;
  const parts = raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : null;
}

function dedupeImageModels(primary: string | undefined, rest: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (m: string) => {
    const k = m.trim();
    if (!k || seen.has(k)) return;
    seen.add(k);
    out.push(k);
  };
  if (primary?.trim()) add(primary.trim());
  for (const m of rest) add(m);
  return out;
}

function imageModelsToTry(): string[] {
  const primary = process.env.XAI_IMAGE_MODEL?.trim();
  const fromList = parseImageModelList(process.env.XAI_IMAGE_MODEL_LIST?.trim());
  const fallback = fromList ?? [...DEFAULT_XAI_IMAGE_MODELS];
  return dedupeImageModels(primary, fallback);
}

/**
 * Grok image generation via xAI OpenAI-compatible `POST /v1/images/generations`.
 * Tries `XAI_IMAGE_MODEL` first, then `XAI_IMAGE_MODEL_LIST` or built-in fallbacks (see `DEFAULT_XAI_IMAGE_MODELS`).
 */
export async function generateXaiImageB64(
  prompt: string,
  style: "image" | "sticker",
): Promise<{ base64: string; mimeType: string }> {
  const key = await resolveXaiApiKey();
  if (!key) {
    throw new Error("Add an xAI API key under API keys to use Grok image generation.");
  }
  const client = new OpenAI({ apiKey: key, baseURL: XAI_BASE_URL });
  const models = imageModelsToTry();
  if (models.length === 0) {
    throw new Error("No image models configured (XAI_IMAGE_MODEL / XAI_IMAGE_MODEL_LIST).");
  }

  let fullPrompt = prompt.trim();
  if (style === "sticker") {
    fullPrompt = `${fullPrompt}\n\nVisual style: flat vector sticker, thick clean outlines, simple shapes, high contrast, readable at small size on a phone, centered square composition, minimal fine detail.`;
  }
  if (fullPrompt.length > 4000) fullPrompt = fullPrompt.slice(0, 4000);

  const errs: string[] = [];
  for (const model of models) {
    try {
      const res = await client.images.generate({
        model,
        prompt: fullPrompt,
        n: 1,
        response_format: "b64_json",
      });

      const first = res.data?.[0];
      const b64 = first?.b64_json;
      if (b64) {
        return { base64: b64, mimeType: "image/png" };
      }
      const url = first?.url;
      if (url?.trim()) {
        const r = await fetch(url);
        if (!r.ok) throw new Error(`Image download failed (${r.status}).`);
        const buf = Buffer.from(await r.arrayBuffer());
        const ct = r.headers.get("content-type")?.split(";")[0]?.trim();
        return { base64: buf.toString("base64"), mimeType: ct && ct.startsWith("image/") ? ct : "image/jpeg" };
      }
      errs.push(`${model}: empty response`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errs.push(`${model}: ${msg}`);
    }
  }

  throw new Error(
    `xAI image generation failed after trying: ${models.join(", ")}. Last error: ${errs[errs.length - 1] ?? "unknown"}. Set XAI_IMAGE_MODEL to a model your team can access (see console.x.ai).`,
  );
}
