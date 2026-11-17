import Image from "next/image";
import { notFound } from "next/navigation";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { BUSINESS_TZ, HOLD_MINUTES } from "@/lib/availability";
import { payDeposit } from "./actions";

export const dynamic = "force-dynamic";

function money(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export default async function PayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const id = rawId.replace(/[^a-zA-Z0-9]/g, "");
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { service: true, staff: true },
  });
  if (!booking) notFound();

  const expired =
    booking.status === "PENDING" &&
    Date.now() - booking.createdAt.getTime() > HOLD_MINUTES * 60_000;

  const when = DateTime.fromJSDate(booking.startsAt, {
    zone: BUSINESS_TZ,
  }).toFormat("EEEE, LLL d 'at' h:mm a");

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
          <p className="text-sm text-plum/70">{when}</p>
          <p className="text-sm text-plum/70">with {booking.staff.name}</p>

          {booking.status === "PENDING" && !expired && (
            <>
              <div className="mt-5 flex justify-between border-t border-plum/10 pt-4 text-sm text-plum">
                <span>Service price</span>
                <span>{money(booking.service.priceCents)}</span>
              </div>
              <div className="mt-2 flex justify-between text-sm font-semibold text-plum">
                <span>Deposit due now</span>
                <span>{money(booking.depositCents)}</span>
              </div>
              <p className="mt-4 text-xs text-plum/60">
                Your card is saved securely for late-cancellation fees. Free
                cancellation up to 24 hours before; 50% fee within 12 to 24
                hours; no-shows forfeit the deposit.
              </p>
              <form action={payDeposit} className="mt-5">
                <input type="hidden" name="id" value={booking.id} />
                <button
                  type="submit"
                  className="w-full rounded bg-plum px-4 py-3 text-sm font-medium text-gold"
                >
                  Pay deposit (test mode)
                </button>
              </form>
              <p className="mt-2 text-center text-xs text-plum/50">
                Test mode: no real card is charged.
              </p>
            </>
          )}

          {expired && (
            <div className="mt-5 text-center">
              <p className="text-sm text-plum/70">
                This hold expired because the deposit was not paid in time.
              </p>
              <a
                href="/book"
                className="mt-2 block text-sm text-gold underline"
              >
                Book again
              </a>
            </div>
          )}

          {booking.status === "CONFIRMED" && (
            <p className="mt-5 rounded bg-gold/20 p-3 text-center text-sm font-medium text-plum">
              Booking confirmed. A confirmation was sent to your WhatsApp.
            </p>
          )}

          {booking.status !== "PENDING" && booking.status !== "CONFIRMED" && (
            <div className="mt-5 text-center">
              <p className="text-sm text-plum/70">
                This booking is no longer active.
              </p>
              <a
                href="/book"
                className="mt-2 block text-sm text-gold underline"
              >
                Book again
              </a>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}