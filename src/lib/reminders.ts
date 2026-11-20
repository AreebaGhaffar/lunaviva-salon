import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { BUSINESS_TZ } from "@/lib/availability";
import { sendMessage } from "@/lib/notify";

const HOUR = 3_600_000;

function when(date: Date) {
  return DateTime.fromJSDate(date, { zone: BUSINESS_TZ }).toFormat(
    "EEEE, LLL d 'at' h:mm a",
  );
}

export async function sendDueReminders(now: DateTime) {
  let sent24 = 0;
  let sent2 = 0;

  // 24-hour reminders
  const candidates24 = await prisma.booking.findMany({
    where: {
      status: { in: ["PENDING", "CONFIRMED"] },
      reminder24Sent: false,
      startsAt: {
        gt: now.plus({ hours: 2 }).toJSDate(),
        lte: now.plus({ hours: 24 }).toJSDate(),
      },
    },
    include: { client: true, service: true },
  });

  for (const b of candidates24) {
    // Skip bookings made less than 24 hours before the appointment.
    if (b.createdAt.getTime() > b.startsAt.getTime() - 24 * HOUR) continue;

    await sendMessage({
      channel: "WHATSAPP",
      to: b.client.phone,
      body: `Hi ${b.client.name}! Reminder: your ${b.service.name} at Lunaviva Salon & Spa is ${when(b.startsAt)}. Changes or cancellations within 24 hours of your appointment may incur a fee.`,
      template: {
        kind: "reminder24",
        params: [b.client.name, b.service.name, when(b.startsAt)],
      },
    });
    await prisma.booking.update({
      where: { id: b.id },
      data: { reminder24Sent: true },
    });
    sent24++;
  }

  // 2-hour reminders
  const candidates2 = await prisma.booking.findMany({
    where: {
      status: { in: ["PENDING", "CONFIRMED"] },
      reminder2Sent: false,
      startsAt: {
        gt: now.toJSDate(),
        lte: now.plus({ hours: 2 }).toJSDate(),
      },
    },
    include: { client: true, service: true },
  });

  for (const b of candidates2) {
    if (b.createdAt.getTime() > b.startsAt.getTime() - 2 * HOUR) continue;

    await sendMessage({
      channel: "WHATSAPP",
      to: b.client.phone,
      body: `Hi ${b.guestName ?? b.client.name}! Your ${b.service.name} at Lunaviva Salon & Spa starts in about 2 hours (${when(b.startsAt)}). See you soon!`,
      template: {
        kind: "reminder2",
        params: [
          b.guestName ?? b.client.name,
          b.service.name,
          when(b.startsAt),
        ],
      },
    });
    await prisma.booking.update({
      where: { id: b.id },
      data: { reminder2Sent: true },
    });
    sent2++;
  }

  return { sent24, sent2 };
}
