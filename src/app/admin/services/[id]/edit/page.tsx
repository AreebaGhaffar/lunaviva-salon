import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateService } from "../../actions";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function EditServicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const service = await prisma.service.findUnique({ where: { id } });
  if (!service) notFound();

  const input =
    "w-full rounded border border-plum/20 px-3 py-2 text-sm text-plum outline-none focus:border-gold";
  const label = "block text-xs tracking-widest text-gold mb-1";

  return (
    <main className="min-h-screen bg-white px-6 py-10">
      <div className="mx-auto max-w-xl">
        <Link href="/admin/services" className="text-sm text-plum/60">
          ← Back to services
        </Link>
        <h1 className="mt-4 text-2xl font-semibold text-plum">Edit service</h1>

        <form action={updateService} className="mt-6 space-y-4">
          <input type="hidden" name="id" value={service.id} />
          <div>
            <label className={label}>DEPARTMENT</label>
            <input name="department" defaultValue={service.department} required className={input} />
          </div>
          <div>
            <label className={label}>SERVICE NAME</label>
            <input name="name" defaultValue={service.name} required className={input} />
          </div>
          <div>
            <label className={label}>DURATION (MINUTES)</label>
            <input name="durationMins" type="number" min="5" step="5" defaultValue={service.durationMins} required className={input} />
          </div>
          <div>
            <label className={label}>PRICE (USD)</label>
            <input name="price" type="number" min="0" step="0.01" defaultValue={(service.priceCents / 100).toFixed(2)} required className={input} />
          </div>
          <button type="submit" className="w-full rounded bg-plum px-4 py-2 text-sm font-medium text-gold">
            Save changes
          </button>
        </form>
      </div>
    </main>
  );
}