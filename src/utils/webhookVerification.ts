/**
 * Webhook verification utilities for payment gateways
 * Handles signature verification for Flutterwave and Paystack
 */

import crypto from 'crypto';

/**
 * Verify Flutterwave webhook signature
 * @param signature - The verif-hash header from Flutterwave
 * @param payload - The webhook payload
 * @param secretHash - Your Flutterwave secret hash
 */
export const verifyFlutterwaveWebhook = (
  signature: string | null,
  payload: any,
  secretHash: string
): boolean => {
  if (!signature) {
    console.error('❌ No signature provided for Flutterwave webhook');
    return false;
  }

  // Flutterwave sends the signature in the verif-hash header
  // It should match your secret hash
  return signature === secretHash;
};

/**
 * Verify Paystack webhook signature
 * @param signature - The x-paystack-signature header
 * @param payload - The raw webhook payload (as string)
 * @param secretKey - Your Paystack secret key
 */
export const verifyPaystackWebhook = (
  signature: string | null,
  payload: string,
  secretKey: string
): boolean => {
  if (!signature) {
    console.error('❌ No signature provided for Paystack webhook');
    return false;
  }

  // Compute HMAC SHA512 of the payload using secret key
  const hash = crypto
    .createHmac('sha512', secretKey)
    .update(payload)
    .digest('hex');

  // Compare computed hash with signature
  return hash === signature;
};

/**
 * Extract payment details from Flutterwave webhook
 */
export const parseFlutterwaveWebhook = (payload: any) => {
  const data = payload.data;

  return {
    status: data.status,
    transactionId: data.id,
    txRef: data.tx_ref,
    amount: data.amount,
    currency: data.currency,
    customerEmail: data.customer?.email,
    paymentType: data.payment_type,
    createdAt: data.created_at,
  };
};

/**
 * Extract payment details from Paystack webhook
 */
export const parsePaystackWebhook = (payload: any) => {
  const data = payload.data;

  return {
    status: data.status,
    reference: data.reference,
    amount: data.amount / 100, // Paystack sends in kobo
    currency: data.currency,
    customerEmail: data.customer?.email,
    paidAt: data.paid_at,
    channel: data.channel,
  };
};

/**
 * Validate webhook event type
 */
export const isValidEventType = (
  event: string,
  validEvents: string[]
): boolean => {
  return validEvents.includes(event);
};

/**
 * Generate idempotency key for payment
 */
export const generateIdempotencyKey = (
  userId: string,
  reference: string,
  timestamp: number = Date.now()
): string => {
  return `${userId}-${reference}-${timestamp}`;
};

/**
 * Generate session idempotency key
 */
export const generateSessionIdempotencyKey = (
  userId: string,
  babalawoId: string | number,
  date: string,
  time: string
): string => {
  return `${userId}-${babalawoId}-${date}-${time}`;
};

/**
 * Sanitize webhook payload for logging
 * Removes sensitive information
 */
export const sanitizeWebhookPayload = (payload: any): any => {
  const sanitized = { ...payload };

  // Remove sensitive fields
  if (sanitized.data) {
    delete sanitized.data.card;
    delete sanitized.data.authorization;
  }

  return sanitized;
};
