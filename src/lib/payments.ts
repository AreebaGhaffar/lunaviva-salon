import { randomUUID } from "node:crypto";

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
// A Stripe version will replace this once the client's keys exist.
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

// The simulated provider must never run on a live site by accident.
// For a demo site, set ALLOW_MOCK_PAYMENTS="true".
export const payments: PaymentProvider =
  process.env.NODE_ENV === "production" &&
  process.env.ALLOW_MOCK_PAYMENTS !== "true"
    ? blocked
    : mock;