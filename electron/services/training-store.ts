import path from "node:path";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { app, dialog, type BrowserWindow } from "electron";
import { TrainingBundleSchema, type TrainingBundle, bundleToPromptText } from "../../shared/training";

export type { TrainingBundle } from "../../shared/training";
export { bundleToPromptText };

const defaultBundle: TrainingBundle = {
  faqs: [],
  priorityContext: "",
  referenceDocs: [],
  businessInfo: "",
  pricing: "",
  services: "",
  bookingRules: "",
  customInstructions: "",
};

function filePath() {
  return path.join(app.getPath("userData"), "business-training.json");
}

export async function loadTraining(): Promise<TrainingBundle> {
  try {
    const raw = await fs.readFile(filePath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return TrainingBundleSchema.parse(parsed);
  } catch {
    return defaultBundle;
  }
}

export async function saveTraining(bundle: TrainingBundle): Promise<void> {
  const parsed = TrainingBundleSchema.parse(bundle);
  await fs.mkdir(path.dirname(filePath()), { recursive: true });
  await fs.writeFile(filePath(), JSON.stringify(parsed, null, 2), "utf8");
}

const REF_TEXT_EXT = new Set(["txt", "md", "json", "csv", "tsv", "log"]);
const MAX_REF_FILES = 12;
const MAX_REF_CHARS_PER_FILE = 10_000;
const MAX_FILE_BYTES = 2_000_000;

export async function pickAndAppendReferenceDocs(
  win: BrowserWindow | null | undefined,
): Promise<{ ok: true; bundle: TrainingBundle } | { ok: false; error: string }> {
  const opts: Electron.OpenDialogOptions = {
    properties: ["openFile", "multiSelections"],
    filters: [{ name: "Text references", extensions: ["txt", "md", "json", "csv", "tsv", "log"] }],
  };
  const r =
    win && !win.isDestroyed()
      ? await dialog.showOpenDialog(win, opts)
      : await dialog.showOpenDialog(opts);
  if (r.canceled || !r.filePaths?.length) return { ok: false, error: "cancelled" };
  return appendReferenceDocsFromPaths(r.filePaths);
}

export async function appendReferenceDocsFromPaths(
  filePaths: string[],
): Promise<{ ok: true; bundle: TrainingBundle } | { ok: false; error: string }> {
  let bundle = await loadTraining();
  const docs = [...(bundle.referenceDocs ?? [])];
  for (const fp of filePaths) {
    if (docs.length >= MAX_REF_FILES) break;
    const ext = path.extname(fp).slice(1).toLowerCase();
    if (!REF_TEXT_EXT.has(ext)) continue;
    const name = path.basename(fp);
    let st: { size: number };
    try {
      st = await fs.stat(fp);
    } catch {
      return { ok: false, error: `Missing file: ${name}` };
    }
    if (st.size > MAX_FILE_BYTES) return { ok: false, error: `Too large (${name}) — max 2 MB` };
    let raw: string;
    try {
      raw = await fs.readFile(fp, "utf8");
    } catch {
      return { ok: false, error: `Could not read as UTF-8 text: ${name}` };
    }
    const text = raw.trim();
    if (!text) continue;
    docs.push({ id: randomUUID(), name, text: text.slice(0, MAX_REF_CHARS_PER_FILE) });
  }
  bundle = { ...bundle, referenceDocs: docs };
  await saveTraining(bundle);
  return { ok: true, bundle };
}
