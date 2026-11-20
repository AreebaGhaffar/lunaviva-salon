import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import {
  SETTINGS_ID,
  canReceive,
  getWhatsAppConfig,
} from "@/lib/whatsapp-settings";
import { deleteWhatsApp, saveWhatsApp, sendTestMessage } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminWhatsAppPage({
  searchParams,
}: {
  searchParams: Promise<{
    saved?: string;
    error?: string;
    test?: string;
    deleted?: string;
  }>;
}) {
  await requireAdmin();
  const flash = await searchParams;

  const config = await getWhatsAppConfig();
  const row = await prisma.whatsAppSettings.findUnique({
    where: { id: SETTINGS_ID },
  });

  const hasCredentials = Boolean(config.phoneNumberId && config.accessToken);
  const status = !hasCredentials
    ? "Not configured"
    : !config.enabled
      ? "Configured, switched off"
      : "Active";
  const receiving = canReceive(config);
  const unreadable = Boolean(row?.accessTokenEnc && !config.accessToken);

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const input =
    "w-full rounded border border-plum/20 px-3 py-2 text-sm text-plum outline-none focus:border-gold";
  const button =
    "rounded bg-plum px-5 py-2 text-sm font-medium text-gold";

  return (
    <main className="min-h-screen bg-white px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-plum">WhatsApp</h1>
          <Link href="/admin/inbox" className="text-sm text-gold underline">
            Inbox
          </Link>
        </div>
        <p className="mt-1 text-sm text-plum/60">
          Connect your WhatsApp Business number so the AI receptionist can chat
          with clients. The rest of the system works fine without it.
        </p>

        {flash.saved && (
          <div className="mt-6 rounded border border-gold/40 bg-gold/10 p-3 text-sm text-plum">
            {flash.saved}
          </div>
        )}
        {flash.test && (
          <div className="mt-6 rounded border border-gold/40 bg-gold/10 p-3 text-sm text-plum">
            {flash.test}
          </div>
        )}
        {flash.deleted && (
          <div className="mt-6 rounded border border-gold/40 bg-gold/10 p-3 text-sm text-plum">
            {flash.deleted}
          </div>
        )}
        {flash.error && (
          <div className="mt-6 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {flash.error}
          </div>
        )}
        {unreadable && (
          <div className="mt-6 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            A saved token could not be read. Enter the access token and app
            secret again and save.
          </div>
        )}

        <div className="mt-6 rounded-lg border border-gold/40 p-5 text-sm text-plum">
          <p>
            <span className="font-semibold">Status:</span> {status}
          </p>
          <p className="mt-1">
            <span className="font-semibold">Sending messages:</span>{" "}
            {config.enabled && hasCredentials ? "On" : "Off (messages are only saved in the Outbox)"}
          </p>
          <p className="mt-1">
            <span className="font-semibold">Receiving messages:</span>{" "}
            {receiving
              ? "On"
              : config.enabled && hasCredentials
                ? "Off: add the app secret to receive client messages"
                : "Off"}
          </p>
        </div>

        <form
          action={saveWhatsApp}
          className="mt-6 space-y-4 rounded-lg border border-gold/40 p-5"
        >
          <h2 className="font-semibold text-plum">Number and credentials</h2>

          <label className="block text-sm text-plum">
            WhatsApp number (for display)
            <input
              name="displayNumber"
              defaultValue={config.displayNumber ?? ""}
              placeholder="+15551234567"
              className={`${input} mt-1`}
            />
          </label>

          <label className="block text-sm text-plum">
            Phone number id
            <input
              name="phoneNumberId"
              defaultValue={config.phoneNumberId ?? ""}
              placeholder="From Meta: WhatsApp, API Setup"
              className={`${input} mt-1`}
            />
          </label>

          <label className="block text-sm text-plum">
            Access token
            <input
              name="accessToken"
              type="password"
              autoComplete="off"
              placeholder={
                config.accessToken
                  ? `Saved (ends in ${config.accessToken.slice(-4)}). Leave blank to keep it.`
                  : "Paste the permanent access token"
              }
              className={`${input} mt-1`}
            />
          </label>

          <label className="block text-sm text-plum">
            App secret
            <input
              name="appSecret"
              type="password"
              autoComplete="off"
              placeholder={
                config.appSecret
                  ? "Saved. Leave blank to keep it."
                  : "From Meta: App settings, Basic"
              }
              className={`${input} mt-1`}
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-plum">
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={config.enabled}
            />
            Turn WhatsApp on
          </label>

          <button type="submit" className={button}>
            Save
          </button>
        </form>

        <div className="mt-6 rounded-lg border border-gold/40 p-5 text-sm text-plum">
          <h2 className="font-semibold">Webhook for Meta</h2>
          <p className="mt-1 text-plum/70">
            In Meta, open WhatsApp, Configuration. Paste these two values and
            subscribe to the messages field.
          </p>
          <p className="mt-3 break-all">
            <span className="font-semibold">Callback URL:</span> {appUrl}
            /api/webhooks/whatsapp
          </p>
          <p className="mt-1 break-all">
            <span className="font-semibold">Verify token:</span>{" "}
            {row?.verifyToken ?? "Appears after you save for the first time"}
          </p>
        </div>

        <form
          action={sendTestMessage}
          className="mt-6 space-y-3 rounded-lg border border-gold/40 p-5"
        >
          <h2 className="font-semibold text-plum">Send a test message</h2>
          <p className="text-sm text-plum/70">
            First send any message from that phone to your WhatsApp number.
            WhatsApp only allows free text for 24 hours after a person messages
            you.
          </p>
          <div className="flex gap-3">
            <input
              name="to"
              placeholder="+15551234567"
              required
              className={input}
            />
            <button type="submit" className={button}>
              Send
            </button>
          </div>
        </form>

        <form
          action={deleteWhatsApp}
          className="mt-6 space-y-3 rounded-lg border border-red-200 p-5"
        >
          <h2 className="font-semibold text-red-700">Delete the connection</h2>
          <p className="text-sm text-plum/70">
            Removes the number, token and secret. The website and bookings keep
            working, and messages are only saved in the Outbox.
          </p>
          <label className="flex items-center gap-2 text-sm text-plum">
            <input type="checkbox" name="confirm" required />I understand
          </label>
          <button
            type="submit"
            className="rounded border border-red-300 px-5 py-2 text-sm font-medium text-red-700"
          >
            Delete
          </button>
        </form>
      </div>
    </main>
  );
}