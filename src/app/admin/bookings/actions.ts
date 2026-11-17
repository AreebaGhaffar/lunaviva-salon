"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { sendMessage } from "@/lib/notify";
import { cancelBookingById } from "@/lib/cancellation";
import { money, when } from "@/lib/format";

export async function updateBookingStatus(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!["CONFIRMED", "COMPLETED", "NO_SHOW"].includes(status)) return;

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { client: true, service: true },
  });
  if (!booking) return;
  if (booking.status !== "PENDING" && booking.status !== "CONFIRMED") return;

  // A no-show forfeits the deposit (already collected).
  const forfeited =
    status === "NO_SHOW" && booking.status === "CONFIRMED"
      ? booking.depositCents
      : 0;

  await prisma.booking.update({
    where: { id },
    data: {
      status: status as "CONFIRMED" | "COMPLETED" | "NO_SHOW",
      feeChargedCents: forfeited,
    },
  });

  if (status === "NO_SHOW") {
    const name = booking.guestName ?? booking.client.name;
    await sendMessage({
      channel: "WHATSAPP",
      to: booking.client.phone,
      body: `Hi ${name}, we missed you at your ${booking.service.name} appointment on ${when(booking.startsAt)}.${
        forfeited > 0
          ? ` As per our no-show policy, your deposit of ${money(forfeited)} has been forfeited.`
          : ""
      }`,
    });
  }

  revalidatePath("/admin/bookings");
}

export async function cancelBooking(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  await cancelBookingById(id);
  revalidatePath("/admin/bookings");
}