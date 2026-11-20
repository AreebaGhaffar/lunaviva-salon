import { createHmac } from "node:crypto";
import { NextResponse, after } from "next/server";
import { safeEqual } from "@/lib/auth";
import { handleIncomingMessage } from "@/lib/chat";
import { rateLimit } from "@/lib/rate-limit";
import { canReceive, getWhatsAppConfig } from "@/lib/whatsapp-settings";

export const dynamic = "force-dynamic";

type WaPayload = {
  entry?: {
    changes?: {
      value?: {
        messages?: {
          id?: string;
          from?: string;
          type?: string;
          text?: { body?: string };
        }[];
      };
    }[];
  }[];
};

function extractMessages(payload: WaPayload) {
  const found: { id: string; from: string; text: string }[] = [];
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const m of change.value?.messages ?? []) {
        if (m.type === "text" && m.id && m.from && m.text?.body) {
          found.push({ id: m.id, from: m.from, text: m.text.body });
        }
      }
    }
  }
  return found;
}

// Meta calls this once, when the webhook is saved in the Meta dashboard.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const config = await getWhatsAppConfig();
  const token = searchParams.get("hub.verify_token") ?? "";
  const challenge = searchParams.get("hub.challenge") ?? "";

  if (
    searchParams.get("hub.mode") === "subscribe" &&
    config.verifyToken &&
    safeEqual(token, config.verifyToken)
  ) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  const raw = await request.text();
  const config = await getWhatsAppConfig();

  // Switched off or not fully set up: accept and ignore, so Meta stops retrying.
  if (!canReceive(config)) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const expected =
    "sha256=" +
    createHmac("sha256", config.appSecret!).update(raw).digest("hex");
  const signature = request.headers.get("x-hub-signature-256") ?? "";
  if (!safeEqual(signature, expected)) {
    return NextResponse.json({ error: "Bad signature" }, { status: 403 });
  }

  let payload: WaPayload;
  try {
    payload = JSON.parse(raw) as WaPayload;
  } catch {
    return NextResponse.json({ error: "Bad body" }, { status: 400 });
  }
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ ok: true });
  }

  const incoming = extractMessages(payload);

  // Answer Meta straight away, then let the AI reply in the background.
  after(async () => {
    for (const m of incoming) {
      try {
        // Meta can deliver the same message twice: handle each id once.
        const fresh = await rateLimit(`wamsg:${m.id}`, 1, 24 * 3600);
        if (!fresh.ok) continue;
        await handleIncomingMessage(`+${m.from}`, m.text);
      } catch (error) {
        console.error("WhatsApp message failed", error);
      }
    }
  });

  return NextResponse.json({ ok: true });
}