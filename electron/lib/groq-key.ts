import https from "node:https";

/**
 * Trim, strip Bearer / quotes, remove zero-width chars and internal whitespace
 * (Groq keys are a single token — pasted HTML often injects invisible chars).
 */
export function normalizeGroqApiKey(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let s = raw.replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
  s = s.replace(/^Bearer\s+/i, "").trim();
  s = s.replace(/^['"`]+|[`'"]+$/g, "").trim();
  s = s.replace(/\s+/g, "");
  return s || undefined;
}

/** Calls Groq HTTP API so we know the key works before saving. */
export function verifyGroqApiKey(key: string): Promise<{ ok: true } | { ok: false; status: number; detail: string }> {
  return new Promise((resolve) => {
    const req = https.request(
      "https://api.groq.com/openai/v1/models",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${key}`,
          Accept: "application/json",
        },
        timeout: 18_000,
      },
      (res) => {
        let data = "";
        res.on("data", (c) => {
          data += c;
        });
        res.on("end", () => {
          const code = res.statusCode ?? 0;
          if (code >= 200 && code < 300) {
            resolve({ ok: true });
            return;
          }
          let detail = data.replace(/\s+/g, " ").trim().slice(0, 400);
          try {
            const j = JSON.parse(data) as { error?: { message?: string } };
            if (j.error?.message) detail = j.error.message;
          } catch {
            /* ignore */
          }
          resolve({
            ok: false,
            status: code,
            detail: detail || res.statusMessage || `HTTP ${code}`,
          });
        });
      },
    );
    req.on("error", (e) => resolve({ ok: false, status: 0, detail: e.message }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, status: 0, detail: "Connection timed out — check network / firewall." });
    });
    req.end();
  });
}
