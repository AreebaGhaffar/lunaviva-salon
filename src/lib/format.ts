import { DateTime } from "luxon";
import { BUSINESS_TZ } from "@/lib/availability";

export function money(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export function when(date: Date) {
  return DateTime.fromJSDate(date, { zone: BUSINESS_TZ }).toFormat(
    "EEEE, LLL d 'at' h:mm a"
  );
}

export function normalizePhone(raw: string) {
  const cleaned = raw.replace(/[^\d+]/g, "");
  if (/^\d{10}$/.test(cleaned)) return `+1${cleaned}`;
  if (/^1\d{10}$/.test(cleaned)) return `+${cleaned}`;
  if (/^\+\d{10,15}$/.test(cleaned)) return cleaned;
  return null;
}