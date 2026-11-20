import Link from "next/link";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { BUSINESS_TZ } from "@/lib/availability";

export const dynamic = "force-dynamic";

function statusStyle(status: string) {
  if (status === "SENT") return "bg-green-100 text-green-800";
  if (status === "FAILED") return "bg-red-100 text-red-800";
  return "bg-plum/10 text-plum";
}

export default async function OutboxPage() {
  await requireAdmin();

  const messages = await prisma.outboxMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <main className="min-h-screen bg-white px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-plum">Message Outbox</h1>
          <Link href="/admin/bookings" className="text-sm text-gold underline">
            Bookings
          </Link>
        </div>
        <p className="mt-1 text-sm text-plum/60">
          Every message is saved here. LOGGED means it was only saved, SENT means
          it was delivered to WhatsApp or email, FAILED means sending was
          attempted and the provider refused it.
        </p>

        <div className="mt-8 space-y-4">
          {messages.map((m) => (
            <div key={m.id} className="rounded-lg border border-gold/40 p-4">
              <div className="flex items-center justify-between gap-3 text-xs text-gold">
                <span>
                  {m.channel} to {m.toAddress}
                </span>
                <span className="flex items-center gap-2">
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-semibold ${statusStyle(
                      String(m.status)
                    )}`}
                  >
                    {String(m.status)}
                  </span>
                  {DateTime.fromJSDate(m.createdAt, { zone: BUSINESS_TZ }).toFormat(
                    "LLL d, h:mm a"
                  )}
                </span>
              </div>
              {m.subject && (
                <p className="mt-2 text-sm font-medium text-plum">{m.subject}</p>
              )}
              <p className="mt-2 whitespace-pre-line text-sm text-plum">{m.body}</p>
            </div>
          ))}
          {messages.length === 0 && (
            <p className="text-sm text-plum/60">No messages yet.</p>
          )}
        </div>
      </div>
    </main>
  );
}