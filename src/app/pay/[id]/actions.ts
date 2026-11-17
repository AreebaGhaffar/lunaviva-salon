"use server";

import { redirect } from "next/navigation";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { payments } from "@/lib/payments";
import { sendMessage } from "@/lib/notify";
import { BUSINESS_TZ, HOLD_MINUTES } from "@/lib/availability";


export async function payDeposit(formData: FormData) {
  const id = String(formData.get("id") ?? "");

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { client: true, service: true },
  });
  if (!booking || booking.status !== "PENDING") redirect(`/pay/${id}`);

  const heldMs = Date.now() - booking.createdAt.getTime();
  if (heldMs > HOLD_MINUTES * 60_000) {
    await prisma.booking.update({
      where: { id },
      data: { status: "CANCELLED" },
    });
    redirect(`/pay/${id}`);
  }

  const result = await payments.collectDeposit({
    bookingId: booking.id,
    clientId: booking.clientId,
    amountCents: booking.depositCents,
  });

  await prisma.booking.update({
    where: { id },
    data: { status: "CONFIRMED", stripePaymentId: result.paymentId },
  });
  await prisma.client.update({
    where: { id: booking.clientId },
    data: { stripePaymentMethodId: result.paymentMethodId },
  });

  const when = DateTime.fromJSDate(booking.startsAt, {
    zone: BUSINESS_TZ,
  }).toFormat("EEEE, LLL d 'at' h:mm a");

  await sendMessage({
    channel: "WHATSAPP",
    to: booking.client.phone,
    body: `Hi ${booking.guestName ?? booking.client.name}! Your ${booking.service.name} at Lunaviva Salon & Spa is confirmed for ${when}. Free cancellation or rescheduling is available up to 24 hours before your appointment. Manage your booking: ${process.env.APP_URL ?? "http://localhost:3000"}/manage/${booking.manageToken}`,
  });

  redirect(`/pay/${id}`);
}
