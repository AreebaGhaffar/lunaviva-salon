import { prisma } from "@/lib/prisma";
import { sendEmailViaResend } from "@/lib/email";

export type OutgoingMessage = {
  channel: "WHATSAPP" | "EMAIL";
  to: string;
  subject?: string;
  body: string;
};

// Every message is saved in the Outbox first. Real sending is switched on
// per channel with settings (EMAIL_PROVIDER="resend"). A failed send is
// marked FAILED and never breaks bookings or cancellations.
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

  if (message.channel === "EMAIL" && process.env.EMAIL_PROVIDER === "resend") {
    try {
      await sendEmailViaResend({
        to: message.to,
        subject: message.subject ?? "Lunaviva Salon & Spa",
        text: message.body,
      });
      await prisma.outboxMessage.update({
        where: { id: saved.id },
        data: { status: "SENT" },
      });
    } catch (error) {
      console.error("Email send failed", error);
      await prisma.outboxMessage.update({
        where: { id: saved.id },
        data: { status: "FAILED" },
      });
    }
  }
}