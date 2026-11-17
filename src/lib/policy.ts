export const FREE_CANCEL_HOURS = 24;
export const LATE_CANCEL_HOURS = 12;

export function cancellationFeeCents({
  startsAt,
  priceCents,
  now = new Date(),
}: {
  startsAt: Date;
  priceCents: number;
  now?: Date;
}) {
  const hours = (startsAt.getTime() - now.getTime()) / 3_600_000;
  if (hours >= FREE_CANCEL_HOURS) return 0;
  if (hours >= LATE_CANCEL_HOURS) return Math.round(priceCents * 0.5);
  return priceCents; // under 12 hours: assumed 100%, confirm with client
}

export const DEPOSIT_PERCENT = 30; // assumption: confirm with client

export function depositCents(priceCents: number) {
  return Math.round((priceCents * DEPOSIT_PERCENT) / 100);
}