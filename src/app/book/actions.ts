"use server";

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getAvailableSlots } from "@/lib/availability";
import { depositCents } from "@/lib/policy";
import { normalizePhone } from "@/lib/format";
import { rateLimit } from "@/lib/rate-limit";

export type BookingResult =
  | { ok: true; bookingId: string; summary: string }
  | { ok: false; error: string };


export async function submitBooking(input: {
  serviceId: string;
  date: string;
  startsAt: string;
  name: string;
  phone: string;
  email: string;
}): Promise<BookingResult> {
  const name = input.name.trim();
  const phone = normalizePhone(input.phone);
  const email = input.email.trim() || null;

  if (!name) return { ok: false, error: "Please enter your name." };
  if (!phone) {
    return { ok: false, error: "Please enter a valid phone number." };
  }
  const limit = await rateLimit(`book:${phone}`, 10, 60 * 60);
  if (!limit.ok) {
    return {
      ok: false,
      error: "Too many booking attempts. Please try again in a little while.",
    };
  }

  const service = await prisma.service.findUnique({
    where: { id: input.serviceId },
  });
  if (!service || !service.active) {
    return { ok: false, error: "That service is not available." };
  }

  // Re-check availability on the server so nobody can book a taken slot.
  const slots = await getAvailableSlots(input.serviceId, input.date);
  const slot = slots.find((s) => s.startsAt === input.startsAt);
  if (!slot) {
    return {
      ok: false,
      error: "Sorry, that time was just taken. Please pick another.",
    };
  }

  const client = await prisma.client.upsert({
    where: { phone },
    update: email ? { email } : {},
    create: { name, phone, email },
  });

  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(startsAt.getTime() + service.durationMins * 60000);

  const booking = await prisma.booking.create({
    data: {
      clientId: client.id,
      serviceId: service.id,
      staffId: slot.staffId,
      startsAt,
      endsAt,
      status: "PENDING",
      guestName: name,
      manageToken: randomUUID(),
      depositCents: depositCents(service.priceCents),
    },
  });

  return {
    ok: true,
    bookingId: booking.id,
    summary: `${service.name} on ${input.date} at ${slot.label} with ${slot.staffName}`,
  };
}
