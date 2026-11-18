"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { payments, usesStripe } from "@/lib/payments";
import { HOLD_MINUTES } from "@/lib/availability";
import { confirmBookingPaid } from "@/lib/booking-payment";
import { createDepositCheckout } from "@/lib/stripe-checkout";

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

  if (usesStripe) {
    const url = await createDepositCheckout(booking);
    redirect(url);
  }

  const result = await payments.collectDeposit({
    bookingId: booking.id,
    clientId: booking.clientId,
    amountCents: booking.depositCents,
  });

  await confirmBookingPaid({
    bookingId: booking.id,
    paymentId: result.paymentId,
    paymentMethodId: result.paymentMethodId,
  });

  redirect(`/pay/${id}`);
}