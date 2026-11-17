import { NextResponse } from "next/server";
import { DateTime } from "luxon";
import { BUSINESS_TZ } from "@/lib/availability";
import { sendDailyBriefing } from "@/lib/briefing";
import { safeEqual } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

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

  const nowNy = DateTime.now().setZone(BUSINESS_TZ);
  const dateParam = searchParams.get("date");
  let day: DateTime;

  if (dateParam) {
    // Manual test for a chosen date: always sends.
    day = DateTime.fromISO(dateParam, { zone: BUSINESS_TZ });
    if (!day.isValid) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }
  } else {
    // Scheduled call: only at 6 AM New York time, once per day.
    if (nowNy.hour !== 6) {
      return NextResponse.json({ ok: true, skipped: "not 6 AM in New York" });
    }
    const once = await rateLimit(`briefing:${nowNy.toISODate()}`, 1, 24 * 3600);
    if (!once.ok) {
      return NextResponse.json({ ok: true, skipped: "already sent today" });
    }
    day = nowNy;
  }

  const preview = await sendDailyBriefing(day);
  return NextResponse.json({ ok: true, preview });
}