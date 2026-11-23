import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatPrice(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export default async function Home() {
  const services = await prisma.service.findMany({
    where: { active: true },
    orderBy: [{ department: "asc" }, { name: "asc" }],
  });

  return (
    <main className="min-h-screen bg-white px-6 py-12">
      <div className="mx-auto flex max-w-3xl flex-col items-center">
        <Image
          src="/logo.png"
          alt="Lunaviva Salon & Spa"
          width={360}
          height={196}
          priority
        />

        <Link
          href="/book"
          className="mt-8 rounded bg-plum px-8 py-3 text-sm font-medium tracking-widest text-gold"
        >
          BOOK NOW
        </Link>

        <h2 className="mt-10 tracking-[0.3em] text-sm text-gold">
          OUR SERVICES
        </h2>

        <div className="mt-8 w-full space-y-4">
          {services.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-lg border border-gold/40 p-5"
            >
              <div>
                <p className="text-xs tracking-widest text-gold">
                  {s.department.toUpperCase()}
                </p>
                <p className="mt-1 text-lg font-medium text-plum">{s.name}</p>
                <p className="text-sm text-plum/60">{s.durationMins} mins</p>
              </div>
              <p className="text-xl font-semibold text-plum">
                {formatPrice(s.priceCents)}
              </p>
            </div>
                    ))}
        </div>

        <Link
          href="/book"
          className="mt-10 rounded bg-plum px-8 py-3 text-sm font-medium tracking-widest text-gold"
        >
          BOOK NOW
        </Link>
      </div>
    </main>
  );
}