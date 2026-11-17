"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSession, destroySession, safeEqual } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

export async function login(formData: FormData) {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";

  const limit = await rateLimit(`login:${ip}`, 8, 15 * 60);
  if (!limit.ok) redirect("/login?error=2");

  const password = String(formData.get("password") ?? "");
  const expected = process.env.ADMIN_PASSWORD ?? "";

  if (!expected || !safeEqual(password, expected)) {
    redirect("/login?error=1");
  }

  await createSession();
  redirect("/admin/services");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}