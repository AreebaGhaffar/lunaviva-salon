import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { BUSINESS_TZ } from "@/lib/availability";
import { sendMessage } from "@/lib/notify";

function money(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export async function buildBriefing(day: DateTime) {
  const dayStart = day.startOf("day");
  const dayEnd = dayStart.plus({ days: 1 });

  const today = await prisma.booking.findMany({
    where: {
      startsAt: { gte: dayStart.toJSDate(), lt: dayEnd.toJSDate() },
      status: { in: ["PENDING", "CONFIRMED", "COMPLETED"] },
    },
    include: { client: true, service: true, staff: true },
    orderBy: { startsAt: "asc" },
  });

  const alerts = await prisma.booking.findMany({
    where: {
      status: { in: ["CANCELLED", "LATE_CANCELLED", "NO_SHOW"] },
      updatedAt: { gte: DateTime.now().minus({ hours: 24 }).toJSDate() },
    },
    include: { client: true, service: true },
    orderBy: { updatedAt: "desc" },
  });

  const revenue = today.reduce((sum, b) => sum + b.service.priceCents, 0);
  const fees = alerts.reduce((sum, b) => sum + b.feeChargedCents, 0);

  const byStaff = new Map<string, string[]>();
  for (const b of today) {
    const time = DateTime.fromJSDate(b.startsAt, { zone: BUSINESS_TZ }).toFormat("h:mm a");
    const line = `  - ${time}  ${b.service.name} (${(b.guestName ?? b.client.name)})`;
    byStaff.set(b.staff.name, [...(byStaff.get(b.staff.name) ?? []), line]);
  }

  const lines: string[] = [];
  lines.push(`Lunaviva Daily Briefing - ${day.toFormat("EEE, LLL d")}`);
  lines.push("");
  lines.push(
    `Projected revenue today: ${money(revenue)} (${today.length} appointment${today.length === 1 ? "" : "s"})`
  );
  lines.push("");
  lines.push("Staff schedules");
  if (byStaff.size === 0) lines.push("  No appointments today.");
  for (const [name, items] of byStaff) {
    lines.push(name);
    lines.push(...items);
  }
  lines.push("");
  lines.push("Cancellation alerts (last 24 hours)");
  if (alerts.length === 0) lines.push("  None.");
  for (const a of alerts) {
    const when = DateTime.fromJSDate(a.startsAt, { zone: BUSINESS_TZ }).toFormat("LLL d, h:mm a");
    const label =
      a.status === "LATE_CANCELLED" ? "Late cancelled" : a.status === "NO_SHOW" ? "No-show" : "Cancelled";
    const fee = a.feeChargedCents > 0 ? `, fee ${money(a.feeChargedCents)}` : "";
    lines.push(`  - ${label}: ${(a.guestName ?? a.client.name)}, ${a.service.name}, ${when}${fee}`);
  }
  if (fees > 0) lines.push(`  Cancellation fees to collect: ${money(fees)}`);

  return lines.join("\n");
}

export async function sendDailyBriefing(day: DateTime) {
  const text = await buildBriefing(day);

  await sendMessage({
    channel: "WHATSAPP",
    to: process.env.ADMIN_WHATSAPP ?? "+15550000001",
    body: text,
  });
  await sendMessage({
    channel: "EMAIL",
    to: process.env.ADMIN_EMAIL ?? "owner@example.com",
    subject: `Lunaviva Daily Briefing - ${day.toFormat("EEE, LLL d")}`,
    body: text,
  });

  return text;
}