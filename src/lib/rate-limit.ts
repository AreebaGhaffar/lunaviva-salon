import { prisma } from "@/lib/prisma";

// Allows `limit` uses of `key` per window. Stored in the database so it
// works on hosting where each request may run on a different server.
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ ok: true } | { ok: false; retryAfterSeconds: number }> {
  const now = new Date();
  const existing = await prisma.rateLimit.findUnique({ where: { key } });

  if (!existing || existing.resetAt <= now) {
    const resetAt = new Date(now.getTime() + windowSeconds * 1000);
    await prisma.rateLimit.upsert({
      where: { key },
      update: { count: 1, resetAt },
      create: { key, count: 1, resetAt },
    });
    return { ok: true };
  }

  if (existing.count >= limit) {
    return {
      ok: false,
      retryAfterSeconds: Math.ceil(
        (existing.resetAt.getTime() - now.getTime()) / 1000
      ),
    };
  }

  await prisma.rateLimit.update({
    where: { key },
    data: { count: { increment: 1 } },
  });
  return { ok: true };
}