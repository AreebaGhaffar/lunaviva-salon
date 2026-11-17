import { prisma } from "@/lib/prisma";
import { sendMessage } from "@/lib/notify";
import { aiEnabled, generateReply } from "@/lib/receptionist";
import { rateLimit } from "@/lib/rate-limit";

const HANDOVER_WORDS = /\b(human|agent|real person|manager|representative)\b/i;

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

  if (HANDOVER_WORDS.test(body)) {
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
