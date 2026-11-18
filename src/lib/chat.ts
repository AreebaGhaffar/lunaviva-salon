import { prisma } from "@/lib/prisma";
import { sendMessage } from "@/lib/notify";
import { aiEnabled, generateReply } from "@/lib/receptionist";
import { rateLimit } from "@/lib/rate-limit";

// A message that is only one of these words, for example "human".
const HANDOVER_EXACT =
  /^\W*(human|agent|person|manager|representative|staff|operator)\W*(please\W*)?$/i;

// Clear requests for a person. "human hair" must not trigger this.
const HANDOVER_PHRASES =
  /\b(real person|real human|live person|live agent|human being|customer service|(talk|speak|chat) (to|with) (a |an |the |your )?(human|person|someone|somebody|manager|agent|representative|staff|team|owner)|(want|need|get me|give me|connect me (to|with)|transfer me to) (a |an |the )?(human(?!\s+hair)|real person|manager|agent|representative|staff member))\b/i;

function wantsHuman(text: string) {
  const t = text.trim();
  return HANDOVER_EXACT.test(t) || HANDOVER_PHRASES.test(t);
}

// Every incoming WhatsApp message goes through this one function,
// whether it comes from the simulator or (later) from Meta's webhook.
export async function handleIncomingMessage(phone: string, text: string) {
  const body = text.trim().slice(0, 2000);
  if (!body) return;
  const limit = await rateLimit(`chat:${phone}`, 20, 10 * 60);
  if (!limit.ok) return;

  const conversation = await prisma.conversation.upsert({
    where: { phone },
    update: { lastMessageAt: new Date() },
    create: { phone },
  });

  await prisma.chatMessage.create({
    data: { conversationId: conversation.id, role: "client", body },
  });

  // A human is handling this chat: the assistant stays quiet.
  if (conversation.handover) return;

  let reply: string;

  if (wantsHuman(body)) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { handover: true, handoverReason: "Client asked for a person" },
    });
    reply =
      "Of course! I've passed your message to our team, and someone will reply here shortly.";
  } else if (!aiEnabled) {
    const appUrl = process.env.APP_URL ?? "http://localhost:3000";
    reply = `Hi! I'm the Lunaviva assistant. You can book any time at ${appUrl}/book. Reply "human" to chat with our team.`;
  } else {
    try {
      reply = await generateReply(conversation.id, phone);
    } catch (error) {
      console.error("Receptionist error", error);
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          handover: true,
          handoverReason: `Assistant error: ${
            error instanceof Error ? error.message : String(error)
          }`.slice(0, 300),
        },
      });
      reply =
        "Sorry, I'm having a little trouble right now. I've passed your message to our team, and they'll reply shortly.";
    }
  }

  await prisma.chatMessage.create({
    data: { conversationId: conversation.id, role: "assistant", body: reply },
  });
  await sendMessage({ channel: "WHATSAPP", to: phone, body: reply });
}
