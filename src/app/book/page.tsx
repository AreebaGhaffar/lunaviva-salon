import Image from "next/image";
import { prisma } from "@/lib/prisma";
import BookingForm from "./BookingForm";

export const dynamic = "force-dynamic";

export default async function BookPage() {
  const services = await prisma.service.findMany({
    where: { active: true },
    orderBy: [{ department: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      department: true,
      durationMins: true,
      priceCents: true,
    },
  });

  return (
    <main className="min-h-screen bg-white px-6 py-10">
      <div className="mx-auto max-w-xl">
        <div className="flex justify-center">
          <Image src="/logo.png" alt="Lunaviva Salon & Spa" width={260} height={142} priority />
        </div>
        <h1 className="mt-6 text-center text-sm tracking-[0.3em] text-gold">
          BOOK AN APPOINTMENT
        </h1>
        <BookingForm services={services} />
      </div>
    </main>
  );
}