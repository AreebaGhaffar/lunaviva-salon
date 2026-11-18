# Lunaviva Salon & Spa: Booking and Operations System

A booking and operations system for Lunaviva Salon & Spa, a high-end US salon.
Clients book on the website or through a WhatsApp AI receptionist, pay a deposit,
get reminders, and can cancel or reschedule by themselves. Cancellation fees are
applied automatically. The owner manages services, prices, staff and bookings in
an admin area and receives a daily 6:00 AM briefing.

Brand colors: Deep Plum `#3B2042` and Polished Gold `#B89753`.

## Status

| Area | Status |
| --- | --- |
| Services, prices, staff, admin area | Done |
| Online booking, 15-minute hold, 15-minute buffer | Done |
| Cancellation rules and automatic no-show | Done |
| Stripe deposits, saved card, late fees, refunds | Working (tested in a Stripe sandbox) |
| Daily briefing by email | Working (tested with Resend) |
| WhatsApp AI receptionist and human handover | Built, tested in a simulator only |
| Reminders (24 hours and 2 hours) | Built, saved to the Outbox (not sent over WhatsApp yet) |
| Real WhatsApp sending and receiving | Not built (needs the client's Meta account) |
| Deployment | Held until the client chooses hosting |

## Tech stack

- Next.js 16 (App Router, Turbopack), React 19, TypeScript
- Tailwind CSS v4 (theme colors are defined in `src/app/globals.css`)
- Prisma 6.19 with PostgreSQL (the client is generated into `src/generated/prisma`)
- luxon (time zones), OpenAI SDK, Stripe, Resend (plain web request)

Do not upgrade to Prisma 8 (release candidate).

## Getting started (Windows, PowerShell)

Requirements: Node.js 24, PostgreSQL 17, Git.

```powershell
cd D:\upwork\Salon\lunaviva-salon
npm install
copy .env.example .env
```

Open `.env` and fill in the values (see "Settings" below). Then create the
database tables and start the app:

```powershell
npx prisma migrate deploy
npm run dev
```

Open http://localhost:3000. The admin area is at http://localhost:3000/login.
Changing `.env` needs a restart of the dev server.

Useful commands:

```powershell
npx prisma studio                          # database viewer, http://localhost:5555
npx tsx prisma/reset-test-data.ts          # clear test bookings, chats, outbox (keeps services and staff)
npm run build                              # production build check
```

If the database errors, start the service in an administrator PowerShell:
`Start-Service postgresql-x64-17`.

### Files you must not overwrite blindly

- `next.config.ts` holds the Tailwind loader rule (without it the site has no
  styling) and the Prisma engine tracing for Vercel.
- `prisma/schema.prisma` generator block needs `binaryTargets` with
  `rhel-openssl-3.0.x` for Vercel.
- `package.json` has a `postinstall` script that runs `prisma generate`.

## Settings (.env)

Names only. Never commit real values. Copy `.env.example` to `.env`.

| Setting | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string (a `$` in the password must be written `%24`) |
| `ADMIN_PASSWORD` | Admin login (no `$`) |
| `SESSION_SECRET` | Signs the admin cookie |
| `CRON_SECRET` | Protects the scheduled-job addresses |
| `APP_URL` | Site address used in links (`http://localhost:3000` locally) |
| `ADMIN_WHATSAPP`, `ADMIN_EMAIL` | Where the briefing and alerts go |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | AI receptionist (`gpt-4o` for delivery) |
| `OPENAI_BASE_URL`, `OPENAI_REASONING_EFFORT` | Development only (alternative provider). Leave empty for OpenAI. |
| `PAYMENTS_PROVIDER` | Empty = simulated payments, `stripe` = real Stripe |
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_test_...` or `sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | Signing secret of the Stripe webhook |
| `EMAIL_PROVIDER` | Empty = Outbox only, `resend` = real email |
| `RESEND_API_KEY`, `EMAIL_FROM` | Resend key and sender address |
| `ALLOW_MOCK_PAYMENTS` | `true` only on a demo site, so simulated payments run in production mode |

## How it works

### Pages

- Public: `/` (live services), `/book`, `/pay/[id]` (deposit), `/manage/[token]`
  (client cancel and reschedule), `/login`.
- Admin (login required): `/admin/bookings`, `/admin/services`, `/admin/staff`,
  `/admin/inbox`, `/admin/outbox`, `/admin/simulator`.
- API: `/api/availability`, `/api/cron/briefing`, `/api/cron/reminders`,
  `/api/cron/release-holds`, `/api/webhooks/stripe`.

### Business rules

| Rule | Value | Where to change it |
| --- | --- | --- |
| Time zone | America/New_York | `BUSINESS_TZ` in `src/lib/availability.ts` |
| Opening hours (assumption) | Mon to Sat 9 to 6, Sunday closed | `HOURS` in `src/lib/availability.ts` |
| Buffer between appointments | 15 minutes | `BUFFER_MINS` |
| Slot step, minimum lead time | 30 minutes, 2 hours | `SLOT_STEP_MINS`, `MIN_LEAD_MINS` |
| Unpaid hold | 15 minutes | `HOLD_MINUTES` |
| Deposit (assumption) | 30% of the service price | `DEPOSIT_PERCENT` in `src/lib/policy.ts` |
| Free cancellation | 24 hours or more before the start | `cancellationFeeCents` in `src/lib/policy.ts` |
| Late fee, 12 to 24 hours | 50% of the service price, deposit counted toward it | same |
| Fee under 12 hours (assumption) | 100% of the service price | same |
| No-show | A paid booking still open 15 minutes after its start is marked NO_SHOW and the deposit is forfeited | `src/lib/noshow.ts` |
| Reminders | 24 hours and 2 hours before | `src/lib/reminders.ts` |
| Daily briefing | 6:00 AM New York time: projected revenue, staff schedules, cancellation alerts | `src/lib/briefing.ts` |
| Rate limits | Login 8 per 15 minutes per IP, chat 20 per 10 minutes per phone, bookings 10 per hour per phone | `src/lib/rate-limit.ts` |

Staff must press Complete in the admin bookings page when a client arrives. A
paid booking left untouched 15 minutes after its start becomes a no-show.

Money is always stored in cents. Booking times are stored in UTC.

### Payments

`src/lib/payments.ts` chooses the provider:

- `PAYMENTS_PROVIDER` empty: simulated payments (no money moves).
- `PAYMENTS_PROVIDER=stripe`: real Stripe. The deposit goes through Stripe
  Checkout and the card is saved for later fees. The booking is confirmed when
  the client returns to the pay page, with `/api/webhooks/stripe` as a backup.
  Late fees are charged to the saved card, and deposits are refunded on free
  cancellations. If a charge or refund fails, the cancellation still completes
  and the owner gets an "ACTION NEEDED" message.

Stripe test card: `4242 4242 4242 4242`, any future expiry, any CVC.

### Messages

`src/lib/notify.ts` saves every WhatsApp or email message to the Outbox first.
With `EMAIL_PROVIDER=resend`, emails are also sent through Resend (status SENT
or FAILED). WhatsApp messages are only saved to the Outbox for now.

### WhatsApp AI receptionist

- Test it in `/admin/simulator`.
- The AI can call: `list_services`, `check_availability`, `create_booking`,
  `get_my_bookings`, `handover_to_human`. It can never charge, refund or cancel.
- A client asking for a person ("human", "can I speak to a manager") hands the
  chat over to the Inbox, where staff reply and click Resume assistant.
- Delivery needs the client's OpenAI key with `OPENAI_MODEL=gpt-4o`.

### Scheduled jobs

All jobs need the `CRON_SECRET` as the header `Authorization: Bearer <secret>`
(or `?secret=` for tests).

| Job | Address | How often |
| --- | --- | --- |
| Reminders and automatic no-shows | `/api/cron/reminders` | Every 10 minutes |
| Release unpaid holds | `/api/cron/release-holds` | Every 5 minutes |
| Daily briefing | `/api/cron/briefing` | 10:00 and 11:00 UTC (it only sends at 6 AM New York, once per day) |

`vercel.json` contains only the two daily briefing jobs, because Vercel's free
plan allows one run per day. Run the other two from a paid plan or a free outside
scheduler such as cron-job.org.

### Test helpers (local)

```text
Briefing now:   /api/cron/briefing?secret=SECRET&date=2026-11-20
Reminders:      /api/cron/reminders?secret=SECRET&now=2026-11-20T19:16:00Z
Release holds:  /api/cron/release-holds?secret=SECRET&minutes=0
```

The `now` value is UTC. New York is UTC minus 5 hours in winter (UTC minus 4 in
summer). A booking at 2:00 PM New York in winter is 19:00 UTC. Reminders also run
the no-show check, so `now` 16 minutes after a paid booking's start marks it as
a no-show.

If the admin login is locked after too many wrong passwords, open Prisma Studio,
open `RateLimit` and delete the row whose key starts with `login:`.

## Going live

1. The client creates the accounts: hosting, PostgreSQL database, Stripe,
   Meta WhatsApp Business, Resend, OpenAI, domain, GitHub. Start Meta first
   because verification takes days.
2. Move the code to the client's private GitHub repository and connect hosting.
3. Create the production database, run `npx prisma migrate deploy`, add the real
   services and staff in the admin area. Do not copy test data.
4. Set the settings in the hosting dashboard with new strong secrets and the final
   `APP_URL`. Leave `ALLOW_MOCK_PAYMENTS` empty.
5. Turn on Stripe (live key, webhook at `APP_URL/api/webhooks/stripe`). Make one
   small real payment and refund it.
6. Turn on email (verified domain, `EMAIL_FROM`), send a test briefing.
7. Switch the AI to GPT-4o, empty `OPENAI_BASE_URL` and `OPENAI_REASONING_EFFORT`,
   retest a full booking chat.
8. Set up the scheduled jobs above.
9. Connect WhatsApp (webhook with signature check, sending code, approved message
   templates for reminders and the briefing). Not built yet.
10. Point the domain, run the final tests, hand the owner the admin guide.

Final tests: pay and confirm a booking, cancel more than 24 hours ahead (refund),
cancel 12 to 24 hours ahead (50% fee), a failing card (booking still cancels, owner
alerted), a no-show after 15 minutes, a full WhatsApp booking and a human
handover, reminders, and the 6:00 AM briefing.

## Decisions the client still needs to confirm

These are assumptions, each defined in one place in the code:

- Opening hours and who works which service (only a test stylist exists).
- Deposit amount (30%).
- Fee for cancelling under 12 hours (100%), and that the 50% fee is of the
  service price with the deposit counted toward it.
- "6:00 AM EST" is built as 6:00 AM New York local time (EDT in summer).
- Reminder rules (the 24-hour reminder is skipped for bookings made less than
  24 hours ahead; reminders also go to unpaid held bookings).
- A transparent PNG or SVG logo (the current file has an off-white box).
- The "5-day rapid delivery" in the project plan depends on the client's accounts
  and Meta's approval; agree on milestones.

## Known limits

- Stripe was tested only in a sandbox, and the payment webhook is untested
  (the return page confirms payments today).
- WhatsApp runs only in the simulator. Real sending and receiving are not built.
- The AI was developed against a Google Gemini model while the OpenAI account had
  no credit. Retest with GPT-4o.
- Allow about half a day of real-world fixes once live accounts are connected.
- The Inbox and Outbox show only the latest 50 entries, with no search.
- The pay page address uses the booking id instead of the private booking token.
- VS Code shows a harmless warning for the Tailwind `@theme` rule only if the
  Tailwind loader is working in the editor; if the running app prints
  "Unknown at rule: @theme", the Tailwind setting in `next.config.ts` is missing.

## Security

- Never commit `.env`. Only `.env.example` (names and fake values) is committed.
- Generate new secrets for every live site and rotate any key that was ever shown
  in a screenshot or chat.
- Do not put secrets in code, issues or chat messages.