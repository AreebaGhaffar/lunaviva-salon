import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { saveTemplates } from "./actions";

export const dynamic = "force-dynamic";

const input =
  "w-full rounded border border-plum/20 px-3 py-2 text-sm text-plum outline-none focus:border-gold";

const FIELDS = [
  {
    key: "confirmation",
    label: "Booking confirmation template name",
    placeholder: "e.g. lunaviva_confirmation",
    text: "Hi {{1}}! Your {{2}} at Lunaviva Salon & Spa is confirmed for {{3}}. Free cancellation or rescheduling is available up to 24 hours before your appointment. Manage your booking here: {{4}} Thank you.",
  },
  {
    key: "reminder24",
    label: "24-hour reminder template name",
    placeholder: "e.g. lunaviva_reminder_24h",
    text: "Hi {{1}}! Reminder: your {{2}} at Lunaviva Salon & Spa is {{3}}. Changes or cancellations within 24 hours of your appointment may incur a fee.",
  },
  {
    key: "reminder2",
    label: "2-hour reminder template name",
    placeholder: "e.g. lunaviva_reminder_2h",
    text: "Hi {{1}}! Your {{2}} at Lunaviva Salon & Spa starts in about 2 hours ({{3}}). See you soon!",
  },
  {
    key: "briefing",
    label: "Daily briefing template name",
    placeholder: "e.g. lunaviva_briefing",
    text: "Lunaviva Salon & Spa daily briefing: {{1}} End of briefing.",
  },
] as const;

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  await requireAdmin();
  const { saved, error } = await searchParams;
  const t = await prisma.whatsAppTemplates.findUnique({
    where: { id: "default" },
  });

  return (
    <main className="min-h-screen bg-white px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-plum">
            WhatsApp templates
          </h1>
          <Link href="/admin/whatsapp" className="text-sm text-gold underline">
            WhatsApp settings
          </Link>
        </div>
        <p className="mt-1 text-sm text-plum/60">
          WhatsApp only allows free text within 24 hours of the client's last
          message. Confirmations, reminders and the briefing usually go out
          later, so they need message templates approved by Meta. Create each
          template in Meta with the exact text shown, then type its name here.
          Leave a name empty to keep sending plain text.
        </p>

        {saved && (
          <p className="mt-4 rounded border border-gold/40 p-3 text-sm text-plum">
            Saved.
          </p>
        )}
        {error && (
          <p className="mt-4 rounded border border-red-300 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <form action={saveTemplates} className="mt-6 space-y-5">
          <div>
            <label className="text-sm text-plum">Template language code</label>
            <input
              name="language"
              defaultValue={t?.language ?? "en_US"}
              className={input}
            />
          </div>
          {FIELDS.map((f) => (
            <div key={f.key}>
              <label className="text-sm text-plum">{f.label}</label>
              <input
                name={f.key}
                defaultValue={t?.[f.key] ?? ""}
                placeholder={f.placeholder}
                className={input}
              />
              <p className="mt-1 text-xs text-plum/60">
                Text to submit to Meta: {f.text}
              </p>
            </div>
          ))}
          <button
            type="submit"
            className="rounded bg-plum px-4 py-2 text-sm font-medium text-gold"
          >
            Save
          </button>
        </form>
      </div>
    </main>
  );
}
