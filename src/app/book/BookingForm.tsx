"use client";

import { useEffect, useState, useTransition } from "react";
import { submitBooking } from "./actions";
import { useRouter } from "next/navigation";

type Service = {
  id: string;
  name: string;
  department: string;
  durationMins: number;
  priceCents: number;
};

type Slot = { startsAt: string; label: string };

function money(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export default function BookingForm({ services }: { services: Service[] }) {
  const router = useRouter();
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [startsAt, setStartsAt] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [pending, startTransition] = useTransition();
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (!serviceId || !date) return;
    let cancelled = false;
    setLoadingSlots(true);
    setStartsAt("");
    fetch(`/api/availability?serviceId=${serviceId}&date=${date}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setSlots(data.slots ?? []);
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });
    return () => {
      cancelled = true;
    };
  }, [serviceId, date, refresh]);

  const input =
    "w-full rounded border border-plum/20 px-3 py-2 text-sm text-plum outline-none focus:border-gold";
  const label = "mb-1 block text-xs tracking-widest text-gold";

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!startsAt) {
      setError("Please choose a time.");
      return;
    }
    startTransition(async () => {
      const result = await submitBooking({
        serviceId,
        date,
        startsAt,
        name,
        phone,
        email,
      });
      if (result.ok) {
        router.push(`/pay/${result.bookingId}`);
      } else {
        setError(result.error);
        setRefresh((n) => n + 1);
      }
    });
  }

  if (done) {
    return (
      <div className="mt-8 rounded-lg border border-gold/40 p-6 text-center">
        <p className="text-lg font-semibold text-plum">Request received</p>
        <p className="mt-2 text-sm text-plum/70">{done}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-5">
      <div>
        <label className={label}>SERVICE</label>
        <select
          value={serviceId}
          onChange={(e) => {
            setServiceId(e.target.value);
            setSlots([]);
          }}
          required
          className={input}
        >
          <option value="">Choose a service</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}: {s.durationMins} min, {money(s.priceCents)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={label}>DATE</label>
        <input
          type="date"
          value={date}
          min={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setDate(e.target.value)}
          required
          className={input}
        />
      </div>

      {serviceId && date && (
        <div>
          <label className={label}>TIME</label>
          {loadingSlots ? (
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
          )}
        </div>
      )}

      <div>
        <label className={label}>FULL NAME</label>
        <input value={name} onChange={(e) => setName(e.target.value)} required className={input} />
      </div>
      <div>
        <label className={label}>PHONE (WHATSAPP)</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 123 4567" required className={input} />
      </div>
      <div>
        <label className={label}>EMAIL (OPTIONAL)</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-plum px-4 py-3 text-sm font-medium text-gold disabled:opacity-60"
      >
        {pending ? "Booking..." : "Request appointment"}
      </button>
    </form>
  );
}
