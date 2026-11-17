import Link from "next/link";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { BUSINESS_TZ } from "@/lib/availability";
import { updateBookingStatus, cancelBooking } from "./actions";

export const dynamic = "force-dynamic";

function money(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  CANCELLED: "Cancelled",
  LATE_CANCELLED: "Late cancelled",
  NO_SHOW: "No-show",
  COMPLETED: "Completed",
};

export default async function AdminBookingsPage() {
  await requireAdmin();

  const bookings = await prisma.booking.findMany({
    orderBy: { startsAt: "asc" },
    include: { client: true, service: true, staff: true },
  });

  const btn = "text-xs font-medium underline";

  return (
    <main className="min-h-screen bg-white px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-plum">Bookings</h1>
          <Link href="/admin/services" className="text-sm text-gold underline">
            Services &amp; pricing
          </Link>
        </div>
        <p className="mt-1 text-sm text-plum/60">All times are New York time.</p>

        <div className="mt-8 overflow-x-auto">
          <table className="w-full text-left text-sm text-plum">
            <thead className="border-b border-gold/40 text-xs tracking-widest text-gold">
              <tr>
                <th className="py-3">WHEN</th>
                <th>CLIENT</th>
                <th>SERVICE</th>
                <th>STAFF</th>
                <th>STATUS</th>
                <th>FEE</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => {
                const open = b.status === "PENDING" || b.status === "CONFIRMED";
                return (
                  <tr key={b.id} className="border-b border-plum/10 align-top">
                    <td className="py-3">
                      {DateTime.fromJSDate(b.startsAt, { zone: BUSINESS_TZ }).toFormat(
                        "EEE, LLL d · h:mm a"
                      )}
                    </td>
                    <td>
                      <div className="font-medium">{(b.guestName ?? b.client.name)}</div>
                      <div className="text-xs text-plum/60">{b.client.phone}</div>
                    </td>
                    <td>{b.service.name}</td>
                    <td>{b.staff.name}</td>
                    <td>{STATUS_LABEL[b.status] ?? b.status}</td>
                    <td>{b.feeChargedCents > 0 ? money(b.feeChargedCents) : "-"}</td>
                    <td>
                      {open && (
                        <div className="flex flex-wrap gap-3">
                          {b.status === "PENDING" && (
                            <form action={updateBookingStatus}>
                              <input type="hidden" name="id" value={b.id} />
                              <input type="hidden" name="status" value="CONFIRMED" />
                              <button className={`${btn} text-gold`}>Confirm</button>
                            </form>
                          )}
                          <form action={updateBookingStatus}>
                            <input type="hidden" name="id" value={b.id} />
                            <input type="hidden" name="status" value="COMPLETED" />
                            <button className={`${btn} text-plum`}>Complete</button>
                          </form>
                          <form action={updateBookingStatus}>
                            <input type="hidden" name="id" value={b.id} />
                            <input type="hidden" name="status" value="NO_SHOW" />
                            <button className={`${btn} text-plum`}>No-show</button>
                          </form>
                          <form action={cancelBooking}>
                            <input type="hidden" name="id" value={b.id} />
                            <button className={`${btn} text-red-700`}>Cancel</button>
                          </form>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {bookings.length === 0 && (
            <p className="mt-6 text-sm text-plum/60">No bookings yet.</p>
          )}
        </div>
      </div>
    </main>
  );
}