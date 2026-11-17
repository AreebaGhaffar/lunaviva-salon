import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { createStaff, toggleStaff, updateStaff } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminStaffPage() {
  await requireAdmin();

  const [staff, services] = await Promise.all([
    prisma.staff.findMany({
      orderBy: { name: "asc" },
      include: { services: true },
    }),
    prisma.service.findMany({
      orderBy: [{ department: "asc" }, { name: "asc" }],
    }),
  ]);

  // Active services that no active staff member performs: clients can't book these.
  const uncovered = services.filter(
    (s) =>
      s.active &&
      !staff.some(
        (m) => m.active && m.services.some((x) => x.serviceId === s.id)
      )
  );

  const input =
    "w-full rounded border border-plum/20 px-3 py-2 text-sm text-plum outline-none focus:border-gold";

  return (
    <main className="min-h-screen bg-white px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-plum">Staff</h1>
          <div className="flex gap-4 text-sm text-gold underline">
            <Link href="/admin/bookings">Bookings</Link>
            <Link href="/admin/services">Services</Link>
          </div>
        </div>
        <p className="mt-1 text-sm text-plum/60">
          Choose which services each person performs. Clients are assigned to
          whoever is free.
        </p>

        {uncovered.length > 0 && (
          <div className="mt-6 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            No active staff member performs: {uncovered.map((s) => s.name).join(", ")}.
            Clients cannot book these services until someone is assigned.
          </div>
        )}

        <form
          action={createStaff}
          className="mt-8 flex gap-3 rounded-lg border border-gold/40 p-5"
        >
          <input name="name" placeholder="New staff member name" required className={input} />
          <button
            type="submit"
            className="rounded bg-plum px-5 py-2 text-sm font-medium text-gold"
          >
            Add
          </button>
        </form>

        <div className="mt-8 space-y-6">
          {staff.map((m) => {
            const assigned = new Set(m.services.map((x) => x.serviceId));
            return (
              <div
                key={m.id}
                className={`rounded-lg border p-5 ${
                  m.active ? "border-gold/40" : "border-plum/10 opacity-60"
                }`}
              >
                <form action={updateStaff} className="space-y-4">
                  <input type="hidden" name="id" value={m.id} />
                  <input name="name" defaultValue={m.name} required className={input} />

                  <div className="grid gap-2 md:grid-cols-2">
                    {services.map((s) => (
                      <label key={s.id} className="flex items-center gap-2 text-sm text-plum">
                        <input
                          type="checkbox"
                          name="serviceId"
                          value={s.id}
                          defaultChecked={assigned.has(s.id)}
                        />
                        {s.name}
                      </label>
                    ))}
                  </div>

                  <button
                    type="submit"
                    className="rounded bg-plum px-4 py-2 text-sm font-medium text-gold"
                  >
                    Save
                  </button>
                </form>

                <form action={toggleStaff} className="mt-3">
                  <input type="hidden" name="id" value={m.id} />
                  <button type="submit" className="text-xs text-plum/60 underline">
                    {m.active ? "Set inactive" : "Set active"}
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}