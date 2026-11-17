"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { rescheduleMyBooking } from "./actions";

type Slot = { startsAt: string; label: string };

export default function RescheduleForm({
  token,
  serviceId,
}: {
  token: string;
  serviceId: string;
}) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [startsAt, setStartsAt] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!date) return;
    let cancelled = false;
    setLoading(true);
    setStartsAt("");
    fetch(
      `/api/availability?serviceId=${serviceId}&date=${date}&manageToken=${token}`
    )
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setSlots(data.slots ?? []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date, serviceId, token]);

  function confirm() {
    setError("");
    startTransition(async () => {
      const result = await rescheduleMyBooking({ token, date, startsAt });
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="mt-3 space-y-3">
      <input
        type="date"
        value={date}
        min={new Date().toISOString().slice(0, 10)}
        onChange={(e) => setDate(e.target.value)}
        className="w-full rounded border border-plum/20 px-3 py-2 text-sm text-plum outline-none focus:border-gold"
      />

      {date &&
        (loading ? (
          <p className="text-sm text-plum/60">Checking availability...</p>
        ) : slots.length === 0 ? (
          <p className="text-sm text-plum/60">
            No times available on this date. Please try another day.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {slots.map((s) => (
              <button
                type="button"
                key={s.startsAt}
                onClick={() => setStartsAt(s.startsAt)}
                className={`rounded border px-2 py-2 text-sm ${
                  startsAt === s.startsAt
                    ? "border-plum bg-plum text-gold"
                    : "border-plum/20 text-plum"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        ))}

      {error && <p className="text-sm text-red-700">{error}</p>}

      <button
        type="button"
        onClick={confirm}
        disabled={!startsAt || pending}
        className="w-full rounded bg-plum px-4 py-2 text-sm font-medium text-gold disabled:opacity-50"
      >
        {pending ? "Saving..." : "Confirm new time"}
      </button>
    </div>
  );
}