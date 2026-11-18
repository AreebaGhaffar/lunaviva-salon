import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

export type PaymentProvider = {
  // Charges the deposit and saves the card for later fees.
  collectDeposit(args: {
    bookingId: string;
    clientId: string;
    amountCents: number;
  }): Promise<{ paymentId: string; paymentMethodId: string }>;

  // Charges the saved card (late cancellation fees).
  chargeSavedCard(args: {
    clientId: string;
    amountCents: number;
    reason: string;
  }): Promise<{ paymentId: string }>;

  // Refunds a previous payment, fully or partly.
  refund(args: {
    paymentId: string;
    amountCents: number;
  }): Promise<{ refundId: string }>;
};

// Test mode: always succeeds, no real money moves.
const mock: PaymentProvider = {
  async collectDeposit() {
    return {
      paymentId: `mock_pi_${randomUUID()}`,
      paymentMethodId: `mock_pm_${randomUUID()}`,
    };
  },
  async chargeSavedCard() {
    return { paymentId: `mock_pi_${randomUUID()}` };
  },
  async refund() {
    return { refundId: `mock_re_${randomUUID()}` };
  },
};

const blocked: PaymentProvider = {
  async collectDeposit() {
    throw new Error("Real payments are not configured.");
  },
  async chargeSavedCard() {
    throw new Error("Real payments are not configured.");
  },
  async refund() {
    throw new Error("Real payments are not configured.");
  },
};

// Real Stripe. Deposits go through Stripe Checkout (see stripe-checkout.ts),
// so collectDeposit is not used here.
const stripeProvider: PaymentProvider = {
  async collectDeposit() {
    throw new Error("Stripe deposits use Checkout.");
  },

  async chargeSavedCard({ clientId, amountCents, reason }) {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client?.stripeCustomerId || !client.stripePaymentMethodId) {
      throw new Error("No saved card for this client.");
    }
    const intent = await getStripe().paymentIntents.create({
      amount: amountCents,
      currency: "usd",
      customer: client.stripeCustomerId,
      payment_method: client.stripePaymentMethodId,
      off_session: true,
      confirm: true,
      description: reason,
    });
    if (intent.status !== "succeeded") {
      throw new Error(`Charge not completed: ${intent.status}`);
    }
    return { paymentId: intent.id };
  },

  async refund({ paymentId, amountCents }) {
    const refund = await getStripe().refunds.create({
      payment_intent: paymentId,
      amount: amountCents,
    });
    return { refundId: refund.id };
  },
};

// Set PAYMENTS_PROVIDER="stripe" to use real Stripe (test or live keys).
export const usesStripe = process.env.PAYMENTS_PROVIDER === "stripe";

// The simulated provider must never run on a live site by accident.
// For a demo site, set ALLOW_MOCK_PAYMENTS="true".
export const payments: PaymentProvider = usesStripe
  ? stripeProvider
  : process.env.NODE_ENV === "production" &&
      process.env.ALLOW_MOCK_PAYMENTS !== "true"
    ? blocked
    : mock;