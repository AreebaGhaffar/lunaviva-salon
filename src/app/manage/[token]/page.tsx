import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { cancellationFeeCents } from "@/lib/policy";
import { money, when } from "@/lib/format";
import { cancelMyBooking } from "./actions";
import RescheduleForm from "./RescheduleForm";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Awaiting deposit",
  CONFIRMED: "Confirmed",
  CANCELLED: "Cancelled",
  LATE_CANCELLED: "Cancelled (late)",
  NO_SHOW: "Missed",
  COMPLETED: "Completed",
};

export default async function ManagePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token: rawToken } = await params;
  // Links pasted from chat can pick up trailing punctuation.
  const token = rawToken.replace(/[^a-fA-F0-9-]/g, "");
  const booking = await prisma.booking.findUnique({
    where: { manageToken: token },
    include: { service: true, staff: true, client: true },
  });
  if (!booking) notFound();

  const open = booking.status === "PENDING" || booking.status === "CONFIRMED";
  const hoursAway = (booking.startsAt.getTime() - Date.now()) / 3_600_000;
  const depositPaid =
    booking.status === "CONFIRMED" && Boolean(booking.stripePaymentId);
  const fee = depositPaid
    ? cancellationFeeCents({
        startsAt: booking.startsAt,
        priceCents: booking.service.priceCents,
      })
    : 0;
  const name = booking.guestName ?? booking.client.name;

  return (
    <main className="min-h-screen bg-white px-6 py-10">
      <div className="mx-auto max-w-md">
        <div className="flex justify-center">
          <Image
            src="/logo.png"
            alt="Lunaviva Salon & Spa"
            width={220}
            height={120}
            priority
          />
        </div>

        <div className="mt-8 rounded-lg border border-gold/40 p-6">
          <p className="text-xs tracking-widest text-gold">YOUR APPOINTMENT</p>
          <p className="mt-2 text-lg font-semibold text-plum">
            {booking.service.name}
          </p>
          <p className="text-sm text-plum/70">{when(booking.startsAt)}</p>
          <p className="text-sm text-plum/70">
            {name} · with {booking.staff.name}
          </p>
          <p className="mt-3 text-sm font-medium text-plum">
            Status: {STATUS_LABEL[booking.status] ?? booking.status}
          </p>
          {booking.feeChargedCents > 0 && (
            <p className="text-sm text-plum/70">
              Fee applied: {money(booking.feeChargedCents)}
            </p>
          )}

          {open && hoursAway >= 24 && (
            <details className="mt-6 border-t border-plum/10 pt-4">
              <summary className="cursor-pointer text-sm font-medium text-plum">
                Reschedule appointment
              </summary>
              <RescheduleForm token={token} serviceId={booking.serviceId} />
            </details>
          )}

          {open && hoursAway < 24 && (
            <p className="mt-6 border-t border-plum/10 pt-4 text-sm text-plum/70">
              Appointments can only be rescheduled online up to 24 hours before.
              Please contact the salon to make changes.
            </p>
          )}
          {open && (
            <details className="mt-6 border-t border-plum/10 pt-4">
              <summary className="cursor-pointer text-sm font-medium text-red-700">
                Cancel appointment
              </summary>
              <p className="mt-3 text-sm text-plum/70">
                {!depositPaid
                  ? "No fee applies because your deposit has not been paid."
                  : fee === 0
                    ? `No fee applies. Your deposit of ${money(booking.depositCents)} will be refunded.`
                    : `This is within 24 hours of your appointment, so a late cancellation fee of ${money(fee)} applies. Your deposit of ${money(booking.depositCents)} is applied toward it and any remainder is charged to your saved card.`}
              </p>
              <form action={cancelMyBooking} className="mt-3">
                <input type="hidden" name="token" value={token} />
                <button
                  type="submit"
                  className="w-full rounded bg-red-700 px-4 py-2 text-sm font-medium text-white"
                >
                  Yes, cancel my appointment
                </button>
              </form>
            </details>
          )}

          {booking.status === "PENDING" && (
            <a
              href={`/pay/${booking.id}`}
              className="mt-4 block text-center text-sm text-gold underline"
            >
              Pay deposit to confirm
            </a>
          )}
        </div>
      </div>
    </main>
  );
}
