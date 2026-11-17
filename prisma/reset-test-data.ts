import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to run in production.");
  }
  const bookings = await prisma.booking.deleteMany();
  const clients = await prisma.client.deleteMany();
  const chats = await prisma.conversation.deleteMany();
  const outbox = await prisma.outboxMessage.deleteMany();
  console.log(
    `Deleted ${bookings.count} bookings, ${clients.count} clients, ${chats.count} chats, ${outbox.count} outbox messages.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());