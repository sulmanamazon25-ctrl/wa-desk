import type { Page } from "puppeteer";

/**
 * Writes AI text into WhatsApp Web's per-chat compose buffer using internal APIs
 * (same idea as WPPConnect wa-js `setInputText`: `setComposeContents` + `ComposeBoxActions`).
 * When multi-device sync supports it, the draft can appear on the phone for that chat.
 *
 * Set `WWEBJS_PHONE_DRAFT_SYNC=0` to disable. Set `WWEBJS_COMPOSE_DRAFT_OPEN_CHAT=1` to call
 * `openChatBottom` first (stronger UI update, but switches the active desktop chat).
 */
export async function syncLinkedComposeDraft(
  page: Page | null | undefined,
  chatId: string,
  text: string,
  opts?: { allowEmptyBody?: boolean },
): Promise<boolean> {
  if (!page || process.env.WWEBJS_PHONE_DRAFT_SYNC === "0") return false;
  const trimmed = text.trim().slice(0, 4096);
  if (!trimmed && !opts?.allowEmptyBody) return false;
  const body = trimmed;
  const openChat = process.env.WWEBJS_COMPOSE_DRAFT_OPEN_CHAT === "1";

  try {
    const ok = await Promise.race([
      page.evaluate(
        async (args: { chatId: string; text: string; openChat: boolean }) => {
          type ChatLike = {
            active?: boolean;
            setComposeContents?: (c: { text: string; timestamp: number }) => void;
          };
          const W = window as unknown as {
            WWebJS?: {
              getChat: (id: string, opts: { getAsModel: boolean }) => Promise<ChatLike | null>;
            };
            require: (m: string) => Record<string, unknown> | undefined;
          };
          if (!W.WWebJS?.getChat) return false;
          const chat = (await W.WWebJS.getChat(args.chatId, { getAsModel: false })) as ChatLike | null;
          if (!chat || typeof chat.setComposeContents !== "function") return false;

          if (args.openChat) {
            try {
              const cmdMod = W.require("WAWebCmd") as
                | { Cmd?: { openChatBottom?: (o: { chat: unknown }) => Promise<void> } }
                | undefined;
              await cmdMod?.Cmd?.openChatBottom?.({ chat });
            } catch {
              /* ignore */
            }
          }

          const ts = Math.floor(Date.now() / 1000);
          chat.setComposeContents({ text: args.text, timestamp: ts });

          try {
            const mod = W.require("WAWebComposeBoxActions") as
              | { ComposeBoxActions?: { setTextContent?: (c: unknown, t: string) => void } }
              | undefined;
            const cba = mod?.ComposeBoxActions;
            if (cba && typeof cba.setTextContent === "function") {
              try {
                cba.setTextContent(chat, args.text);
              } catch {
                /* inactive / UI not ready — compose buffer was still updated above */
              }
            }
          } catch {
            /* setComposeContents may still sync compose state */
          }
          return true;
        },
        { chatId, text: body, openChat },
      ),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 9000)),
    ]);
    return ok === true;
  } catch {
    return false;
  }
}
