"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { handleIncomingMessage } from "@/lib/chat";
import { normalizePhone } from "@/lib/format";

export async function sendSimulatedMessage(formData: FormData) {
  await requireAdmin();
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  const text = String(formData.get("text") ?? "");

  if (!phone || !text.trim()) redirect("/admin/simulator");

  await handleIncomingMessage(phone, text);
  redirect(`/admin/simulator?phone=${encodeURIComponent(phone)}`);
}