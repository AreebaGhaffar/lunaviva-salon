import { NextResponse } from "next/server";
import { DateTime } from "luxon";
import { sendDueReminders } from "@/lib/reminders";
import { safeEqual } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = process.env.CRON_SECRET ?? "";
  const provided =
    request.headers.get("authorization")?.replace("Bearer ", "") ??
    searchParams.get("secret") ??
    "";

  if (!secret || !safeEqual(provided, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // "now" can be overridden for testing only.
  const nowParam = searchParams.get("now");
  const now = nowParam ? DateTime.fromISO(nowParam) : DateTime.now();
  if (!now.isValid) {
    return NextResponse.json({ error: "Invalid now" }, { status: 400 });
  }

  const result = await sendDueReminders(now);
  return NextResponse.json({ ok: true, ...result });
}