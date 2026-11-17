"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { cancelBookingById } from "@/lib/cancellation";
import { getAvailableSlots } from "@/lib/availability";
import { sendMessage } from "@/lib/notify";
import { when } from "@/lib/format";

export async function cancelMyBooking(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  if (!token) return;

  const booking = await prisma.booking.findUnique({
    where: { manageToken: token },
  });
  if (!booking) return;

  await cancelBookingById(booking.id);
  redirect(`/manage/${token}`);
}

export type RescheduleResult =
  | { ok: true; label: string }
  | { ok: false; error: string };

export async function rescheduleMyBooking(input: {
  token: string;
  date: string;
  startsAt: string;
}): Promise<RescheduleResult> {
  const booking = await prisma.booking.findUnique({
    where: { manageToken: input.token },
    include: { service: true, client: true },
  });
  if (
    !booking ||
    (booking.status !== "PENDING" && booking.status !== "CONFIRMED")
  ) {
    return { ok: false, error: "This booking can no longer be changed." };
  }

  const hoursAway = (booking.startsAt.getTime() - Date.now()) / 3_600_000;
  if (hoursAway < 24) {
    return {
      ok: false,
      error:
        "Appointments can only be rescheduled online up to 24 hours before. Please contact the salon.",
    };
  }

  const slots = await getAvailableSlots(
    booking.serviceId,
    input.date,
    booking.id
  );
  const slot = slots.find((s) => s.startsAt === input.startsAt);
  if (!slot) {
    return {
      ok: false,
      error: "Sorry, that time is no longer available. Please pick another.",
    };
  }

  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(
    startsAt.getTime() + booking.service.durationMins * 60000
  );

  await prisma.booking.update({
    where: { id: booking.id },
    data: {
      startsAt,
      endsAt,
      staffId: slot.staffId,
      reminder24Sent: false,
      reminder2Sent: false,
    },
  });

  const name = booking.guestName ?? booking.client.name;
  await sendMessage({
    channel: "WHATSAPP",
    to: booking.client.phone,
    body: `Hi ${name}, your ${booking.service.name} appointment has been moved to ${when(startsAt)}. Manage your booking: ${process.env.APP_URL ?? "http://localhost:3000"}/manage/${input.token}`,
  });

  return { ok: true, label: when(startsAt) };
}