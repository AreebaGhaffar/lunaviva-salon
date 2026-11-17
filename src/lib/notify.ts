import { prisma } from "@/lib/prisma";

export type OutgoingMessage = {
  channel: "WHATSAPP" | "EMAIL";
  to: string;
  subject?: string;
  body: string;
};

// Development mode: messages are saved to the Outbox table instead of being
// sent. Real WhatsApp and email sending will replace this function later.
export async function sendMessage(message: OutgoingMessage) {
  await prisma.outboxMessage.create({
    data: {
      channel: message.channel,
      toAddress: message.to,
      subject: message.subject ?? null,
      body: message.body,
      status: "LOGGED",
    },
  });
}