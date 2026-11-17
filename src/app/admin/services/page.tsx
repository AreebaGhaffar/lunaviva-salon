import { requireAdmin } from "@/lib/auth";
import { logout } from "@/app/login/actions";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createService, toggleService, deleteService } from "./actions";

export const dynamic = "force-dynamic";

function formatPrice(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export default async function AdminServicesPage() {
  await requireAdmin();
  const services = await prisma.service.findMany({
    orderBy: [{ department: "asc" }, { name: "asc" }],
  });

  const input =
    "w-full rounded border border-plum/20 px-3 py-2 text-sm text-plum outline-none focus:border-gold";

  return (
    <main className="min-h-screen bg-white px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-semibold text-plum">
          Services &amp; Pricing
        </h1>
        <p className="mt-1 text-sm text-plum/60">
          Changes appear on the client website immediately.
        </p>
        <form action={logout} className="mt-3">
          <button type="submit" className="text-xs text-plum/60 underline">
            Sign out
          </button>
        </form>

        <form
          action={createService}
          className="mt-8 grid gap-3 rounded-lg border border-gold/40 p-5 md:grid-cols-5"
        >
          <input
            name="department"
            placeholder="Department"
            required
            className={input}
          />
          <input
            name="name"
            placeholder="Service name"
            required
            className={`${input} md:col-span-2`}
          />
          <input
            name="durationMins"
            type="number"
            min="5"
            step="5"
            placeholder="Minutes"
            required
            className={input}
          />
          <input
            name="price"
            type="number"
            min="0"
            step="0.01"
            placeholder="Price (USD)"
            required
            className={input}
          />
          <button
            type="submit"
            className="rounded bg-plum px-4 py-2 text-sm font-medium text-gold md:col-span-5"
          >
            Add service
          </button>
        </form>

        <div className="mt-8 overflow-x-auto">
          <table className="w-full text-left text-sm text-plum">
            <thead className="border-b border-gold/40 text-xs tracking-widest text-gold">
              <tr>
                <th className="py-3">DEPARTMENT</th>
                <th>SERVICE</th>
                <th>DURATION</th>
                <th>PRICE</th>
                <th>STATUS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.id} className="border-b border-plum/10">
                  <td className="py-3">{s.department}</td>
                  <td className="font-medium">{s.name}</td>
                  <td>{s.durationMins} mins</td>
                  <td>{formatPrice(s.priceCents)}</td>
                  <td>
                    <form action={toggleService}>
                      <input type="hidden" name="id" value={s.id} />
                      <button
                        type="submit"
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          s.active
                            ? "bg-gold/20 text-plum"
                            : "bg-plum/10 text-plum/50"
                        }`}
                      >
                        {s.active ? "Active" : "Hidden"}
                      </button>
                    </form>
                  </td>
                  <td>
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/admin/services/${s.id}/edit`}
                        className="text-xs font-medium text-gold underline"
                      >
                        Edit
                      </Link>
                      <form action={deleteService}>
                        <input type="hidden" name="id" value={s.id} />
                        <button
                          type="submit"
                          className="text-xs font-medium text-red-700 underline"
                        >
                          Delete
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
