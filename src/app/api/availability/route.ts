import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAvailableSlots } from "@/lib/availability";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const serviceId = searchParams.get("serviceId");
  const date = searchParams.get("date");
  const manageToken = searchParams.get("manageToken");

  if (!serviceId || !date) {
    const services = await prisma.service.findMany({
      where: { active: true },
      select: { id: true, name: true },
    });
    return NextResponse.json({
      hint: "Add ?serviceId=...&date=YYYY-MM-DD",
      services,
    });
  }

  let excludeId: string | undefined;
  if (manageToken) {
    const own = await prisma.booking.findUnique({
      where: { manageToken },
      select: { id: true },
    });
    excludeId = own?.id;
  }

  const slots = await getAvailableSlots(serviceId, date, excludeId);
  return NextResponse.json({ count: slots.length, slots });
}