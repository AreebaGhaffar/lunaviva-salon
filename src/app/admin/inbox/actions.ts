"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { sendMessage } from "@/lib/notify";

export async function replyToChat(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const body = String(formData.get("body") ?? "")
    .trim()
    .slice(0, 1500);
  if (!id || !body) return;

  const conversation = await prisma.conversation.findUnique({ where: { id } });
  if (!conversation) return;

  await prisma.chatMessage.create({
    data: { conversationId: id, role: "admin", body },
  });
  // A human replied, so the assistant stays quiet until resumed.
  await prisma.conversation.update({
    where: { id },
    data: { handover: true, lastMessageAt: new Date() },
  });
  await sendMessage({ channel: "WHATSAPP", to: conversation.phone, body });

  revalidatePath("/admin/inbox");
}

export async function resumeAssistant(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.conversation.update({
    where: { id },
    data: { handover: false, handoverReason: null },
  });
  await prisma.chatMessage.create({
    data: {
      conversationId: id,
      role: "note",
      body: "Assistant resumed by the team.",
    },
  });
  revalidatePath("/admin/inbox");
}
