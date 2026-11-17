"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

function refresh() {
  revalidatePath("/admin/services");
  revalidatePath("/");
}

export async function createService(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const department = String(formData.get("department") ?? "").trim();
  const durationMins = Number(formData.get("durationMins"));
  const price = Number(formData.get("price"));

  if (
    !name ||
    !department ||
    !Number.isFinite(durationMins) ||
    durationMins <= 0 ||
    !Number.isFinite(price) ||
    price < 0
  ) {
    return;
  }

  await prisma.service.create({
    data: {
      name,
      department,
      durationMins: Math.round(durationMins),
      priceCents: Math.round(price * 100),
    },
  });
  refresh();
}

export async function toggleService(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const service = await prisma.service.findUnique({ where: { id } });
  if (!service) return;

  await prisma.service.update({
    where: { id },
    data: { active: !service.active },
  });
  refresh();
}

export async function updateService(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const department = String(formData.get("department") ?? "").trim();
  const durationMins = Number(formData.get("durationMins"));
  const price = Number(formData.get("price"));

  if (
    !id ||
    !name ||
    !department ||
    !Number.isFinite(durationMins) ||
    durationMins <= 0 ||
    !Number.isFinite(price) ||
    price < 0
  ) {
    return;
  }

  await prisma.service.update({
    where: { id },
    data: {
      name,
      department,
      durationMins: Math.round(durationMins),
      priceCents: Math.round(price * 100),
    },
  });
  refresh();
  redirect("/admin/services");
}

export async function deleteService(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const bookingCount = await prisma.booking.count({ where: { serviceId: id } });
  if (bookingCount > 0) {
    await prisma.service.update({ where: { id }, data: { active: false } });
  } else {
    await prisma.service.delete({ where: { id } });
  }
  refresh();
}