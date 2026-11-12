import { describe, expect, it } from "vitest";
import { verifyWithProvider } from "../src/services/payments.js";
import type { Services } from "../src/services/context.js";

/**
 * Fees are passed to the client by the providers' own settings, so the provider charges price + fee.
 * Verification must count only our price towards the payment, and report the fee for the books.
 */
const svcWith = (body: unknown) => ({
  config: { PAYSTACK_SECRET_KEY: "sk_test_x", FLW_SECRET_KEY: "FLWSECK_TEST-x" },
  fetch: (async () => new Response(JSON.stringify(body), { status: 200 })) as typeof fetch,
}) as unknown as Services;

describe("provider fee on top of the price", () => {
  it("Paystack: requested_amount is our price, fees is the fee", async () => {
    const v = await verifyWithProvider(svcWith({ status: true, data: {
      status: "success", id: 7, currency: "NGN", amount: 1025381, requested_amount: 1000000, fees: 25381 } }), "paystack", "r1");
    expect(v).toEqual({ state: "paid", amount: 10000, currency: "NGN", txId: "7", fee: 253.81, charged: 10253.81 });
  });

  it("Paystack without pass-through: the amount is the price", async () => {
    const v = await verifyWithProvider(svcWith({ status: true, data: {
      status: "success", id: 8, currency: "NGN", amount: 1000000, fees: 25000 } }), "paystack", "r2");
    expect(v).toMatchObject({ state: "paid", amount: 10000, fee: 250, charged: 10000 });
  });

  it("Flutterwave: amount is our price, charged_amount includes the fee", async () => {
    const v = await verifyWithProvider(svcWith({ status: "success", data: {
      status: "successful", id: 9, currency: "NGN", amount: 10000, charged_amount: 10215, app_fee: 215 } }), "flutterwave", "r3");
    expect(v).toEqual({ state: "paid", amount: 10000, currency: "NGN", txId: "9", fee: 215, charged: 10215 });
  });
});
