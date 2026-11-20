"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { encryptSecret } from "@/lib/secret-box";
import { normalizePhone } from "@/lib/format";
import { sendWhatsAppText } from "@/lib/whatsapp";
import {
  SETTINGS_ID,
  getWhatsAppConfig,
  newVerifyToken,
} from "@/lib/whatsapp-settings";

function back(kind: "saved" | "error" | "deleted" | "test", message: string): never {
  redirect(`/admin/whatsapp?${kind}=${encodeURIComponent(message)}`);
}

export async function saveWhatsApp(formData: FormData) {
  await requireAdmin();

  const existing = await prisma.whatsAppSettings.findUnique({
    where: { id: SETTINGS_ID },
  });

  const numberRaw = String(formData.get("displayNumber") ?? "").trim();
  const phoneNumberId = String(formData.get("phoneNumberId") ?? "").trim();
  const accessToken = String(formData.get("accessToken") ?? "").trim();
  const appSecret = String(formData.get("appSecret") ?? "").trim();
  const enabled = formData.get("enabled") === "on";

  let displayNumber: string | null = null;
  if (numberRaw) {
    displayNumber = normalizePhone(numberRaw);
    if (!displayNumber) {
      back("error", "That WhatsApp number is not valid. Use a format like +15551234567.");
    }
  }
  if (phoneNumberId && !/^\d{5,25}$/.test(phoneNumberId)) {
    back("error", "The Phone number id should contain digits only.");
  }

  // A blank token or secret keeps the one already saved.
  const accessTokenEnc = accessToken
    ? encryptSecret(accessToken)
    : (existing?.accessTokenEnc ?? null);
  const appSecretEnc = appSecret
    ? encryptSecret(appSecret)
    : (existing?.appSecretEnc ?? null);
  const finalPhoneId = phoneNumberId || null;

  if (enabled && !(finalPhoneId && accessTokenEnc)) {
    back(
      "error",
      "Add the Phone number id and the access token before turning WhatsApp on.",
    );
  }

  const data = {
    enabled,
    displayNumber,
    phoneNumberId: finalPhoneId,
    accessTokenEnc,
    appSecretEnc,
    verifyToken: existing?.verifyToken ?? newVerifyToken(),
  };

  await prisma.whatsAppSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, ...data },
    update: data,
  });

  revalidatePath("/admin/whatsapp");
  back("saved", enabled ? "Saved. WhatsApp is switched on." : "Saved. WhatsApp is switched off.");
}

export async function deleteWhatsApp(formData: FormData) {
  await requireAdmin();
  if (formData.get("confirm") !== "on") {
    back("error", "Tick the box to confirm the deletion.");
  }
  await prisma.whatsAppSettings.deleteMany({ where: { id: SETTINGS_ID } });
  revalidatePath("/admin/whatsapp");
  back("deleted", "The WhatsApp number and all credentials were deleted.");
}

export async function sendTestMessage(formData: FormData) {
  await requireAdmin();

  const to = normalizePhone(String(formData.get("to") ?? ""));
  if (!to) back("error", "Enter the phone number to test with, like +15551234567.");

  const config = await getWhatsAppConfig();
  if (!config.phoneNumberId || !config.accessToken) {
    back("error", "Save the Phone number id and access token first.");
  }

  let failure: string | null = null;
  try {
    await sendWhatsAppText({
      phoneNumberId: config.phoneNumberId,
      accessToken: config.accessToken,
      to,
      body: "Test message from Lunaviva Salon & Spa. Your WhatsApp connection works.",
    });
  } catch (error) {
    failure = error instanceof Error ? error.message : "Unknown error";
  }

  if (failure) back("error", `Test message failed. ${failure}`.slice(0, 300));
  back("test", `Test message sent to ${to}.`);
}