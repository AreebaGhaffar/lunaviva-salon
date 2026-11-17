import Link from "next/link";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { BUSINESS_TZ } from "@/lib/availability";
import { replyToChat, resumeAssistant } from "./actions";

export const dynamic = "force-dynamic";

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  await requireAdmin();
  const { c } = await searchParams;

  const conversations = await prisma.conversation.findMany({
    orderBy: [{ handover: "desc" }, { lastMessageAt: "desc" }],
    take: 50,
    include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
  });

  const selected = c
    ? await prisma.conversation.findUnique({
        where: { id: c },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      })
    : null;

  const waiting = conversations.filter((x) => x.handover).length;

  return (
    <main className="min-h-screen bg-white px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-semibold text-plum">
          Inbox{" "}
          {waiting > 0 && (
            <span className="ml-2 rounded-full bg-gold px-2 py-0.5 text-xs text-plum">
              {waiting} need a person
            </span>
          )}
        </h1>

        <div className="mt-6 grid gap-6 md:grid-cols-[280px_1fr]">
          <div className="space-y-2">
            {conversations.map((x) => (
              <Link
                key={x.id}
                href={`/admin/inbox?c=${x.id}`}
                className={`block rounded-lg border p-3 text-sm ${
                  c === x.id ? "border-plum" : "border-gold/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-plum">{x.phone}</span>
                  {x.handover && (
                    <span className="rounded-full bg-gold/30 px-2 text-[10px] text-plum">
                      NEEDS PERSON
                    </span>
                  )}
                </div>
                <p className="mt-1 truncate text-xs text-plum/60">
                  {x.messages[0]?.body ?? ""}
                </p>
              </Link>
            ))}
            {conversations.length === 0 && (
              <p className="text-sm text-plum/60">No chats yet.</p>
            )}
          </div>

          <div>
            {!selected ? (
              <p className="text-sm text-plum/60">Choose a chat on the left.</p>
            ) : (
              <div>
                <div className="flex items-center justify-between">
                  <p className="font-medium text-plum">{selected.phone}</p>
                  {selected.handover && (
                    <form action={resumeAssistant}>
                      <input type="hidden" name="id" value={selected.id} />
                      <button
                        type="submit"
                        className="rounded border border-plum px-3 py-1 text-xs text-plum"
                      >
                        Resume assistant
                      </button>
                    </form>
                  )}
                </div>
                {selected.handover && selected.handoverReason && (
                  <p className="mt-1 text-xs text-plum/60">
                    Reason: {selected.handoverReason}
                  </p>
                )}

                <div className="mt-4 space-y-3 rounded-lg border border-gold/40 p-4">
                  {selected.messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex ${m.role === "client" ? "justify-start" : "justify-end"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                          m.role === "client"
                            ? "bg-plum/10 text-plum"
                            : m.role === "admin"
                              ? "bg-plum text-gold"
                              : "bg-gold/20 text-plum"
                        }`}
                      >
                        <p className="whitespace-pre-line">{m.body}</p>
                        <p className="mt-1 text-[10px] opacity-60">
                          {m.role === "client" ? "Client" : m.role === "admin" ? "Team" : "Assistant"} ·{" "}
                          {DateTime.fromJSDate(m.createdAt, { zone: BUSINESS_TZ }).toFormat(
                            "LLL d, h:mm a"
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <form action={replyToChat} className="mt-4 space-y-2">
                  <input type="hidden" name="id" value={selected.id} />
                  <textarea
                    name="body"
                    rows={3}
                    required
                    placeholder="Reply as the salon team..."
                    className="w-full rounded border border-plum/20 px-3 py-2 text-sm text-plum outline-none focus:border-gold"
                  />
                  <button
                    type="submit"
                    className="w-full rounded bg-plum px-4 py-2 text-sm font-medium text-gold"
                  >
                    Send reply
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}