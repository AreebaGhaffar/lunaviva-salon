import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";

export const BUSINESS_TZ = "America/New_York";
export const BUFFER_MINS = 15;
export const SLOT_STEP_MINS = 30;
export const MIN_LEAD_MINS = 120;
export const HOLD_MINUTES = 15;

// Luxon weekdays: 1 = Monday ... 7 = Sunday. null = closed.
export const HOURS: Record<number, { open: number; close: number } | null> = {
  1: { open: 9, close: 18 },
  2: { open: 9, close: 18 },
  3: { open: 9, close: 18 },
  4: { open: 9, close: 18 },
  5: { open: 9, close: 18 },
  6: { open: 9, close: 18 },
  7: null,
};

export type Slot = {
  startsAt: string;
  label: string;
  staffId: string;
  staffName: string;
};

export async function getAvailableSlots(
  serviceId: string,
  date: string,
  excludeBookingId?: string,
): Promise<Slot[]> {
  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service || !service.active) return [];

  const day = DateTime.fromISO(date, { zone: BUSINESS_TZ });
  if (!day.isValid) return [];

  const hours = HOURS[day.weekday];
  if (!hours) return [];

  const dayStart = day.startOf("day").set({ hour: hours.open });
  const dayEnd = day.startOf("day").set({ hour: hours.close });

  const staff = await prisma.staff.findMany({
    where: { active: true, services: { some: { serviceId } } },
  });
  if (staff.length === 0) return [];

  const bookings = await prisma.booking.findMany({
    where: {
      staffId: { in: staff.map((s) => s.id) },
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
      OR: [
        { status: "CONFIRMED" },
        {
          status: "PENDING",
          createdAt: {
            gte: DateTime.now().minus({ minutes: HOLD_MINUTES }).toJSDate(),
          },
        },
      ],
      startsAt: { lt: dayEnd.plus({ minutes: BUFFER_MINS }).toJSDate() },
      endsAt: { gt: dayStart.minus({ minutes: BUFFER_MINS }).toJSDate() },
    },
  });

  const earliest = DateTime.now().plus({ minutes: MIN_LEAD_MINS });
  const slots: Slot[] = [];

  for (
    let start = dayStart;
    start.plus({ minutes: service.durationMins }) <= dayEnd;
    start = start.plus({ minutes: SLOT_STEP_MINS })
  ) {
    if (start < earliest) continue;

    const end = start.plus({ minutes: service.durationMins });

    const freeStaff = staff.find((member) =>
      bookings
        .filter((b) => b.staffId === member.id)
        .every((b) => {
          const bStart = DateTime.fromJSDate(b.startsAt);
          const bEnd = DateTime.fromJSDate(b.endsAt);
          const clashes =
            bStart < end.plus({ minutes: BUFFER_MINS }) &&
            bEnd.plus({ minutes: BUFFER_MINS }) > start;
          return !clashes;
        }),
    );

    if (freeStaff) {
      slots.push({
        startsAt: start.toUTC().toISO()!,
        label: start.toFormat("h:mm a"),
        staffId: freeStaff.id,
        staffName: freeStaff.name,
      });
    }
  }

  return slots;
}
