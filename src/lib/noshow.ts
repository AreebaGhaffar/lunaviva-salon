import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { sendMessage } from "@/lib/notify";
import { money, when } from "@/lib/format";

export const NO_SHOW_GRACE_MINS = 15;

export async function markNoShows(now: DateTime) {
  const cutoff = now.minus({ minutes: NO_SHOW_GRACE_MINS }).toJSDate();

  const due = await prisma.booking.findMany({
    where: { status: "CONFIRMED", startsAt: { lt: cutoff } },
    include: { client: true, service: true },
  });

  let noShows = 0;

  for (const b of due) {
    // The status check makes sure we never process the same booking twice.
    const result = await prisma.booking.updateMany({
      where: { id: b.id, status: "CONFIRMED" },
      data: { status: "NO_SHOW", feeChargedCents: b.depositCents },
    });
    if (result.count === 0) continue;

    const name = b.guestName ?? b.client.name;
    await sendMessage({
      channel: "WHATSAPP",
      to: b.client.phone,
      body: `Hi ${name}, we missed you at your ${b.service.name} appointment on ${when(b.startsAt)}.${
        b.depositCents > 0
          ? ` As per our no-show policy, your deposit of ${money(b.depositCents)} has been forfeited.`
          : ""
      }`,
    });
    noShows++;
  }

  return { noShows };
}