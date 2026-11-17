"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function createStaff(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await prisma.staff.create({ data: { name } });
  revalidatePath("/admin/staff");
}

export async function toggleStaff(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const member = await prisma.staff.findUnique({ where: { id } });
  if (!member) return;

  await prisma.staff.update({
    where: { id },
    data: { active: !member.active },
  });
  revalidatePath("/admin/staff");
}

export async function updateStaff(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const serviceIds = formData.getAll("serviceId").map(String);
  if (!id || !name) return;

  await prisma.$transaction([
    prisma.staff.update({ where: { id }, data: { name } }),
    prisma.staffService.deleteMany({ where: { staffId: id } }),
    prisma.staffService.createMany({
      data: serviceIds.map((serviceId) => ({ staffId: id, serviceId })),
    }),
  ]);
  revalidatePath("/admin/staff");
}