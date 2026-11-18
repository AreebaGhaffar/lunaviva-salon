import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { sendMessage } from "@/lib/notify";
import { confirmBookingPaid } from "@/lib/booking-payment";

type CheckoutBooking = {
  id: string;
  depositCents: number;
  client: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    stripeCustomerId: string | null;
  };
  service: { name: string };
};

// Creates the Stripe payment page for the deposit and returns its address.
// The card is saved for later fees (off-session use).
export async function createDepositCheckout(booking: CheckoutBooking) {
  const stripe = getStripe();
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  let customerId = booking.client.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: booking.client.name,
      phone: booking.client.phone,
      email: booking.client.email ?? undefined,
      metadata: { clientId: booking.client.id },
    });
    customerId = customer.id;
    await prisma.client.update({
      where: { id: booking.client.id },
      data: { stripeCustomerId: customerId },
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    client_reference_id: booking.id,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: booking.depositCents,
          product_data: { name: `Deposit - ${booking.service.name}` },
        },
      },
    ],
    payment_intent_data: {
      setup_future_usage: "off_session",
      metadata: { bookingId: booking.id },
    },
    metadata: { bookingId: booking.id },
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    success_url: `${appUrl}/pay/${booking.id}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/pay/${booking.id}`,
  });

  if (!session.url) throw new Error("Stripe did not return a payment page");
  return session.url;
}

// Safe to call many times (the return page and the webhook both call it).
export async function confirmDepositFromSession(
  session: Stripe.Checkout.Session,
) {
  const bookingId = session.metadata?.bookingId;
  if (!bookingId || session.payment_status !== "paid") return false;

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
  if (!paymentIntentId) return false;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { client: true, service: true },
  });
  if (!booking) return false;

  // Already processed earlier.
  if (booking.stripePaymentId) return true;

  const stripe = getStripe();

  if (booking.status !== "PENDING") {
    // The 15-minute hold was released before the payment arrived: refund it.
    try {
      await stripe.refunds.create({ payment_intent: paymentIntentId });
    } catch (error) {
      console.error("Refund of late payment failed", error);
    }
    const admin = process.env.ADMIN_WHATSAPP;
    if (admin) {
      await sendMessage({
        channel: "WHATSAPP",
        to: admin,
        body: `ACTION NEEDED: ${booking.client.name} paid a deposit after the hold for booking ${booking.id} expired. We tried to refund it automatically. Please check Stripe.`,
      });
    }
    return false;
  }

  const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
  const paymentMethodId =
    typeof intent.payment_method === "string"
      ? intent.payment_method
      : (intent.payment_method?.id ?? null);

  return confirmBookingPaid({
    bookingId,
    paymentId: paymentIntentId,
    paymentMethodId,
  });
}

export async function confirmDepositFromSessionId(
  sessionId: string,
  bookingId: string,
) {
  const session = await getStripe().checkout.sessions.retrieve(sessionId);
  // A session from another booking must never confirm this one.
  if (session.metadata?.bookingId !== bookingId) return false;
  return confirmDepositFromSession(session);
}