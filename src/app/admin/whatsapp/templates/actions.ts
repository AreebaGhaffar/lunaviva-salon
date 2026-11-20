"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

const BASE = "/admin/whatsapp/templates";
const NAME = /^[a-z0-9_]{1,200}$/;
const LANG = /^[a-z]{2,3}(_[A-Z]{2})?$/;

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function fail(message: string): never {
  redirect(`${BASE}?error=${encodeURIComponent(message)}`);
}

export async function saveTemplates(formData: FormData) {
  await requireAdmin();
  const language = field(formData, "language") || "en_US";
  const confirmation = field(formData, "confirmation");
  const reminder24 = field(formData, "reminder24");
  const reminder2 = field(formData, "reminder2");
  const briefing = field(formData, "briefing");

  if (!LANG.test(language)) fail("Language code looks like en_US or en.");
  for (const name of [confirmation, reminder24, reminder2, briefing]) {
    if (name && !NAME.test(name)) {
      fail("Template names use lowercase letters, numbers and underscores only.");
    }
  }

  const data = {
    language,
    confirmation: confirmation || null,
    reminder24: reminder24 || null,
    reminder2: reminder2 || null,
    briefing: briefing || null,
  };
  await prisma.whatsAppTemplates.upsert({
    where: { id: "default" },
    create: { id: "default", ...data },
    update: data,
  });
  revalidatePath(BASE);
  redirect(`${BASE}?saved=1`);
}