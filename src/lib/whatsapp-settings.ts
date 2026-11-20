import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/secret-box";

export const SETTINGS_ID = "default";

export type WhatsAppConfig = {
  enabled: boolean;
  displayNumber: string | null;
  phoneNumberId: string | null;
  accessToken: string | null;
  appSecret: string | null;
  verifyToken: string | null;
};

export async function getWhatsAppConfig(): Promise<WhatsAppConfig> {
  const row = await prisma.whatsAppSettings.findUnique({
    where: { id: SETTINGS_ID },
  });
  return {
    enabled: row?.enabled ?? false,
    displayNumber: row?.displayNumber ?? null,
    phoneNumberId: row?.phoneNumberId ?? null,
    accessToken: row?.accessTokenEnc ? decryptSecret(row.accessTokenEnc) : null,
    appSecret: row?.appSecretEnc ? decryptSecret(row.appSecretEnc) : null,
    verifyToken: row?.verifyToken ?? null,
  };
}

// Sending needs the switch on, plus the phone number id and access token.
export function canSend(config: WhatsAppConfig) {
  return (
    config.enabled && Boolean(config.phoneNumberId) && Boolean(config.accessToken)
  );
}

// Receiving also needs the app secret, to prove messages really come from Meta.
export function canReceive(config: WhatsAppConfig) {
  return canSend(config) && Boolean(config.appSecret);
}

export function newVerifyToken() {
  return randomBytes(16).toString("hex");
}