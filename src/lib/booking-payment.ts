import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { sendMessage } from "@/lib/notify";
import { BUSINESS_TZ } from "@/lib/availability";

export async function confirmBookingPaid(args: {
  bookingId: string;
  paymentId: string;
  paymentMethodId: string | null;
}) {
  const booking = await prisma.booking.findUnique({
    where: { id: args.bookingId },
    include: { client: true, service: true },
  });
  if (!booking) return false;

  // Only a still-pending booking can be confirmed, and only once.
  const updated = await prisma.booking.updateMany({
    where: { id: booking.id, status: "PENDING" },
    data: { status: "CONFIRMED", stripePaymentId: args.paymentId },
  });
  if (updated.count === 0) return false;

  if (args.paymentMethodId) {
    await prisma.client.update({
      where: { id: booking.clientId },
      data: { stripePaymentMethodId: args.paymentMethodId },
    });
  }

  const when = DateTime.fromJSDate(booking.startsAt, {
    zone: BUSINESS_TZ,
  }).toFormat("EEEE, LLL d 'at' h:mm a");

  await sendMessage({
    channel: "WHATSAPP",
    to: booking.client.phone,
    body: `Hi ${booking.guestName ?? booking.client.name}! Your ${booking.service.name} at Lunaviva Salon & Spa is confirmed for ${when}. Free cancellation or rescheduling is available up to 24 hours before your appointment. Manage your booking: ${process.env.APP_URL ?? "http://localhost:3000"}/manage/${booking.manageToken}`,
  });

  return true;
}