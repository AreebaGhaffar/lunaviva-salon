import Link from "next/link";
import type { ReactNode } from "react";
import { isAdmin } from "@/lib/auth";
import { logout } from "@/app/login/actions";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const signedIn = await isAdmin();

  return (
    <div>
      {signedIn && (
        <nav className="bg-plum px-6 py-3 text-sm text-gold">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-5">
            <span className="tracking-widest">LUNAVIVA ADMIN</span>
            <Link href="/admin/bookings">Bookings</Link>
            <Link href="/admin/inbox">Inbox</Link>
            <Link href="/admin/services">Services</Link>
            <Link href="/admin/staff">Staff</Link>
            <Link href="/admin/outbox">Outbox</Link>
            <Link href="/admin/simulator">Simulator</Link>
            <form action={logout} className="ml-auto">
              <button type="submit" className="underline">
                Sign out
              </button>
            </form>
          </div>
        </nav>
      )}
      {children}
    </div>
  );
}