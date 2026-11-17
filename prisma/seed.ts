import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.service.count();
  if (existing > 0) {
    console.log("Services already exist, skipping seed.");
    return;
  }

  const balayage = await prisma.service.create({
    data: {
      department: "Hair Care",
      name: "Signature Balayage & Cut",
      durationMins: 120,
      priceCents: 24000,
    },
  });
  const facial = await prisma.service.create({
    data: {
      department: "Skincare & Spa",
      name: "Organic Anti-Aging Facial",
      durationMins: 60,
      priceCents: 15000,
    },
  });
  const manipedi = await prisma.service.create({
    data: {
      department: "Nail Lounge",
      name: "Lunaviva Luxury ManiPedi",
      durationMins: 75,
      priceCents: 11000,
    },
  });

  await prisma.staff.create({
    data: {
      name: "Sample Stylist",
      services: {
        create: [
          { serviceId: balayage.id },
          { serviceId: facial.id },
          { serviceId: manipedi.id },
        ],
      },
    },
  });

  console.log("Seeded 3 services and 1 staff member.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());