import { prisma } from "@/lib/prisma";
import { cancellationFeeCents } from "@/lib/policy";
import { payments } from "@/lib/payments";
import { sendMessage } from "@/lib/notify";
import { money, when } from "@/lib/format";

async function alertAdmin(body: string) {
  const to = process.env.ADMIN_WHATSAPP;
  if (!to) return;
  try {
    await sendMessage({ channel: "WHATSAPP", to, body });
  } catch (error) {
    console.error("Admin alert failed", error);
  }
}

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

  let note = "";
  let feeCollected = fee;
  let problem: string | null = null;

  if (fee === 0) {
    if (depositPaid && booking.stripePaymentId) {
      try {
        await payments.refund({
          paymentId: booking.stripePaymentId,
          amountCents: booking.depositCents,
        });
        note = `No cancellation fee applies, and your deposit of ${money(booking.depositCents)} has been refunded.`;
      } catch (error) {
        console.error("Refund failed", error);
        problem = `Refund of ${money(booking.depositCents)} failed`;
        note =
          "No cancellation fee applies. We could not process your deposit refund automatically, so our team will take care of it and contact you shortly.";
      }
    } else {
      note = "No cancellation fee applies.";
    }
  } else {
    const remainder = Math.max(0, fee - booking.depositCents);
    let chargeFailed = false;

    if (remainder > 0) {
      try {
        await payments.chargeSavedCard({
          clientId: booking.clientId,
          amountCents: remainder,
          reason: `Late cancellation fee for booking ${booking.id}`,
        });
      } catch (error) {
        console.error("Late fee charge failed", error);
        chargeFailed = true;
      }
    }

    const intro = `Because this was cancelled less than 24 hours before your appointment, a late cancellation fee of ${money(fee)} applies.`;

    if (chargeFailed) {
      // Only the deposit was actually collected.
      feeCollected = booking.depositCents;
      problem = `Late fee of ${money(remainder)} could not be charged to the saved card`;
      note = `${intro} Your deposit of ${money(booking.depositCents)} was applied, but we could not charge the remaining ${money(remainder)} to your saved card. Our team will contact you shortly.`;
    } else {
      note = `${intro} Your deposit of ${money(booking.depositCents)} was applied${
        remainder > 0 ? ` and ${money(remainder)} was charged to your saved card` : ""
      }.`;
    }
  }

  await prisma.booking.update({
    where: { id },
    data: {
      status: fee > 0 ? "LATE_CANCELLED" : "CANCELLED",
      feeChargedCents: feeCollected,
    },
  });

  await sendMessage({
    channel: "WHATSAPP",
    to: booking.client.phone,
    body: `Hi ${name}, your ${booking.service.name} appointment on ${when(booking.startsAt)} has been cancelled. ${note}`,
  });

  if (problem) {
    await alertAdmin(
      `ACTION NEEDED: ${problem} for ${name}, ${booking.service.name} on ${when(booking.startsAt)}. Booking ${booking.id}. Please follow up manually.`,
    );
  }

  return true;
}