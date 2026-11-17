import { NextResponse } from "next/server";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { HOLD_MINUTES } from "@/lib/availability";
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

  // "minutes" can be overridden for testing only.
  const minutesParam = Number(searchParams.get("minutes"));
  const minutes = Number.isFinite(minutesParam) && searchParams.get("minutes") !== null
    ? minutesParam
    : HOLD_MINUTES;

  const result = await prisma.booking.updateMany({
    where: {
      status: "PENDING",
      createdAt: { lt: DateTime.now().minus({ minutes }).toJSDate() },
    },
    data: { status: "CANCELLED" },
  });

  return NextResponse.json({ ok: true, released: result.count });
}