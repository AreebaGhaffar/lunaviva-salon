import { prisma } from "@/lib/prisma";
import { cancellationFeeCents } from "@/lib/policy";
import { payments } from "@/lib/payments";
import { sendMessage } from "@/lib/notify";
import { money, when } from "@/lib/format";

export async function cancelBookingById(id: string) {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { service: true, client: true },
  });
  if (!booking) return false;
  if (booking.status !== "PENDING" && booking.status !== "CONFIRMED") {
    return false;
  }

  const name = booking.guestName ?? booking.client.name;
  const depositPaid =
    booking.status === "CONFIRMED" && Boolean(booking.stripePaymentId);
  const cardOnFile = Boolean(booking.client.stripePaymentMethodId);

  // Fees only apply when a deposit was paid and a card is saved.
  const fee =
    depositPaid && cardOnFile
      ? cancellationFeeCents({
          startsAt: booking.startsAt,
          priceCents: booking.service.priceCents,
        })
      : 0;

  let note: string;

  if (fee === 0) {
    if (depositPaid && booking.stripePaymentId) {
      await payments.refund({
        paymentId: booking.stripePaymentId,
        amountCents: booking.depositCents,
      });
      note = `No cancellation fee applies, and your deposit of ${money(booking.depositCents)} has been refunded.`;
    } else {
      note = "No cancellation fee applies.";
    }
  } else {
    const remainder = Math.max(0, fee - booking.depositCents);
    if (remainder > 0) {
      await payments.chargeSavedCard({
        clientId: booking.clientId,
        amountCents: remainder,
        reason: `Late cancellation fee for booking ${booking.id}`,
      });
    }
    note = `Because this was cancelled less than 24 hours before your appointment, a late cancellation fee of ${money(fee)} applies. Your deposit of ${money(booking.depositCents)} was applied${
      remainder > 0 ? ` and ${money(remainder)} was charged to your saved card` : ""
    }.`;
  }

  await prisma.booking.update({
    where: { id },
    data: {
      status: fee > 0 ? "LATE_CANCELLED" : "CANCELLED",
      feeChargedCents: fee,
    },
  });

  await sendMessage({
    channel: "WHATSAPP",
    to: booking.client.phone,
    body: `Hi ${name}, your ${booking.service.name} appointment on ${when(booking.startsAt)} has been cancelled. ${note}`,
  });

  return true;
}