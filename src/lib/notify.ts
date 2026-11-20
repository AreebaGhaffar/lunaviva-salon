import { prisma } from "@/lib/prisma";
import { sendEmailViaResend } from "@/lib/email";
import { sendWhatsAppText } from "@/lib/whatsapp";
import {
  canSend,
  getWhatsAppConfig,
  type WhatsAppConfig,
} from "@/lib/whatsapp-settings";

export type OutgoingMessage = {
  channel: "WHATSAPP" | "EMAIL";
  to: string;
  subject?: string;
  body: string;
};

async function markStatus(id: string, status: "SENT" | "FAILED") {
  await prisma.outboxMessage.update({ where: { id }, data: { status } });
}

async function deliverWhatsApp(message: OutgoingMessage, outboxId: string) {
  let config: WhatsAppConfig;
  try {
    config = await getWhatsAppConfig();
  } catch (error) {
    // Settings unavailable: behave as if WhatsApp is not set up.
    console.error("WhatsApp settings unavailable", error);
    return;
  }
  if (!canSend(config)) return;

  try {
    await sendWhatsAppText({
      phoneNumberId: config.phoneNumberId!,
      accessToken: config.accessToken!,
      to: message.to,
      body: message.body,
    });
    await markStatus(outboxId, "SENT");
  } catch (error) {
    console.error("WhatsApp send failed", error);
    await markStatus(outboxId, "FAILED");
  }
}

// Every message is saved in the Outbox first. Real sending depends on the
// settings: WhatsApp is managed on the admin WhatsApp page, email by
// EMAIL_PROVIDER. A failed send is marked FAILED and never breaks bookings.
export async function sendMessage(message: OutgoingMessage) {
  const saved = await prisma.outboxMessage.create({
    data: {
      channel: message.channel,
      toAddress: message.to,
      subject: message.subject ?? null,
      body: message.body,
      status: "LOGGED",
    },
  });

  if (message.channel === "WHATSAPP") {
    await deliverWhatsApp(message, saved.id);
    return;
  }

  if (message.channel === "EMAIL" && process.env.EMAIL_PROVIDER === "resend") {
    try {
      await sendEmailViaResend({
        to: message.to,
        subject: message.subject ?? "Lunaviva Salon & Spa",
        text: message.body,
      });
      await markStatus(saved.id, "SENT");
    } catch (error) {
      console.error("Email send failed", error);
      await markStatus(saved.id, "FAILED");
    }
  }
}