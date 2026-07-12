import { spawn } from "node:child_process";

let ffmpegOkCache: boolean | null = null;

export async function isFfmpegAvailable(): Promise<boolean> {
  if (ffmpegOkCache != null) return ffmpegOkCache;
  ffmpegOkCache = await new Promise<boolean>((resolve) => {
    const p = spawn("ffmpeg", ["-version"], { windowsHide: true });
    p.on("error", () => resolve(false));
    p.on("close", (code) => resolve(code === 0));
  });
  return ffmpegOkCache;
}

function inputFormatHint(mimetype?: string, filename?: string): string | null {
  const mime = (mimetype ?? "").toLowerCase();
  const fn = (filename ?? "").toLowerCase();
  if (mime.includes("ogg") || mime.includes("opus") || fn.endsWith(".ogg") || fn.endsWith(".opus")) {
    return "ogg";
  }
  if (mime.includes("mpeg") || mime.includes("mp3") || fn.endsWith(".mp3")) return "mp3";
  if (mime.includes("mp4") || mime.includes("m4a") || fn.endsWith(".m4a")) return "mp4";
  if (mime.includes("webm") || fn.endsWith(".webm")) return "webm";
  return null;
}

/**
 * Normalize WhatsApp voice blobs to 16 kHz mono WAV for STT providers.
 * Returns null when ffmpeg is missing or conversion fails (caller uses raw buffer).
 */
export async function convertAudioToWav16k(
  inputBuffer: Buffer,
  meta?: { mimetype?: string; filename?: string },
): Promise<Buffer | null> {
  if (!inputBuffer?.length) return null;
  if (!(await isFfmpegAvailable())) return null;

  const hint = inputFormatHint(meta?.mimetype, meta?.filename);
  const args = ["-hide_banner", "-loglevel", "error"];
  if (hint) args.push("-f", hint);
  args.push("-i", "pipe:0", "-ar", "16000", "-ac", "1", "-f", "wav", "pipe:1");

  return new Promise((resolve) => {
    const ffmpeg = spawn("ffmpeg", args, { windowsHide: true });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    let settled = false;

    const done = (result: Buffer | null) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    ffmpeg.stdout.on("data", (c: Buffer) => out.push(c));
    ffmpeg.stderr.on("data", (c: Buffer) => err.push(c));
    ffmpeg.on("error", () => done(null));
    ffmpeg.on("close", (code) => {
      if (code !== 0) {
        if (process.env.WWEBJS_DEV_LOG === "1" && err.length) {
          console.warn("[desk] ffmpeg normalize failed:", Buffer.concat(err).toString("utf8").slice(0, 400));
        }
        done(null);
        return;
      }
      const wav = Buffer.concat(out);
      done(wav.length > 44 ? wav : null);
    });

    ffmpeg.stdin.write(inputBuffer);
    ffmpeg.stdin.end();
  });
}
