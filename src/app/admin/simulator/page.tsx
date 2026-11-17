import Link from "next/link";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { BUSINESS_TZ } from "@/lib/availability";
import { sendSimulatedMessage } from "./actions";

export const dynamic = "force-dynamic";

export default async function SimulatorPage({
  searchParams,
}: {
  searchParams: Promise<{ phone?: string }>;
}) {
  await requireAdmin();
  const { phone } = await searchParams;
  const activePhone = phone ?? "+15551234567";

  const conversation = await prisma.conversation.findUnique({
    where: { phone: activePhone },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  const input =
    "w-full rounded border border-plum/20 px-3 py-2 text-sm text-plum outline-none focus:border-gold";

  return (
    <main className="min-h-screen bg-white px-6 py-10">
      <div className="mx-auto max-w-xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-plum">
            WhatsApp Simulator
          </h1>
          <Link href="/admin/bookings" className="text-sm text-gold underline">
            Bookings
          </Link>
        </div>
        <p className="mt-1 text-sm text-plum/60">
          Pretend to be a client texting the salon. Test mode only.
        </p>

        {conversation?.handover && (
          <div className="mt-4 rounded border border-gold bg-gold/10 p-3 text-sm text-plum">
            This chat was handed over to a human. The assistant is paused.
            {conversation.handoverReason && (
              <span className="mt-1 block text-xs text-plum/70">
                Reason: {conversation.handoverReason}
              </span>
            )}
          </div>
        )}

        <div className="mt-6 space-y-3 rounded-lg border border-gold/40 p-4">
          {(conversation?.messages ?? []).map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === "client" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  m.role === "client"
                    ? "bg-plum text-gold"
                    : "bg-plum/10 text-plum"
                }`}
              >
                <p className="whitespace-pre-line">{m.body}</p>
                <p className="mt-1 text-[10px] opacity-60">
                  {m.role === "client"
                    ? "Client"
                    : m.role === "admin"
                      ? "Team"
                      : "Assistant"}{" "}
                  ·{" "}
                  {DateTime.fromJSDate(m.createdAt, {
                    zone: BUSINESS_TZ,
                  }).toFormat("h:mm a")}
                </p>
              </div>
            </div>
          ))}
          {!conversation && (
            <p className="text-sm text-plum/60">
              No messages yet. Say hello below.
            </p>
          )}
        </div>

        <form action={sendSimulatedMessage} className="mt-4 space-y-3">
          <input name="phone" defaultValue={activePhone} className={input} />
          <textarea
            name="text"
            rows={2}
            placeholder="Type a message as the client..."
            required
            className={input}
          />
          <button
            type="submit"
            className="w-full rounded bg-plum px-4 py-2 text-sm font-medium text-gold"
          >
            Send as client
          </button>
        </form>
      </div>
    </main>
  );
}
