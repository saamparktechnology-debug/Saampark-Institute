'use client';

import React, { useState } from 'react';
import { AlertCircle, CreditCard } from 'lucide-react';
import { extractErrorMessage } from '@/lib/axios';
import {
  useCreatePaymentOrderMutation,
  useVerifyRazorpayCheckoutMutation,
} from '../hooks/finance.hook';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (
        event: string,
        callback: (response: {
          error?: {
            code?: string;
            description?: string;
            source?: string;
            step?: string;
            reason?: string;
            metadata?: { order_id?: string; payment_id?: string };
          };
        }) => void
      ) => void;
    };
  }
}

/**
 * Dynamically loads the official Razorpay Standard Checkout script:
 * `<script src="https://checkout.razorpay.com/v1/checkout.js"></script>`
 * Reference: https://razorpay.com/docs/payments/server-integration/nodejs/integration-steps
 */
async function loadRazorpayStandardCheckoutScript(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (window.Razorpay) return true;

  return new Promise((resolve) => {
    const existing = document.querySelector(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
    ) as HTMLScriptElement | null;

    if (existing) {
      existing.addEventListener('load', () => resolve(Boolean(window.Razorpay)));
      existing.addEventListener('error', () => resolve(false));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

/**
 * Formats customer phone to Razorpay's required `+{country_code}{number}` format
 * (e.g. `+919876543210` without hyphens or spaces) so Razorpay Standard Checkout
 * pre-fills the customer's mobile number cleanly.
 */
function formatPhoneForRazorpayPrefill(rawPhone?: string | null): string {
  const digits = (rawPhone || '').replace(/\D/g, '');
  if (!digits) return '+919876543210';
  if (digits.length === 10) return `+91${digits}`;
  if (digits.startsWith('91') && digits.length === 12) return `+${digits}`;
  return `+${digits}`;
}

export interface RazorpayInstallmentPayButtonProps {
  enrollmentId: string;
  installmentId?: string;
  sequenceNumber?: number;
  installmentSequenceNumber?: number;
  amount?: string;
  amountInr?: string;
  currency?: string;
  courseTitle?: string;
  studentName?: string;
  studentEmail?: string | null;
  studentPhone?: string | null;
  compact?: boolean;
  buttonLabel?: string;
  onPaymentSuccess?: () => void;
}

/**
 * Official Razorpay Standard Checkout Integration (`https://checkout.razorpay.com/v1/checkout.js`).
 * Zero custom/dummy modals — strictly follows Razorpay's official 6-step Node.js + JS Checkout flow:
 * 1. Calls backend `POST /api/v1/payments/orders` which creates a real order via Razorpay Orders API (`order_...`).
 * 2. Opens Razorpay's official hosted checkout (`new window.Razorpay(options).open()`) with UPI QR, UPI ID, Cards, Netbanking, Wallet, and Pay Later.
 * 3. Listens for `payment.failed` via `rzp1.on('payment.failed', ...)` and displays the exact gateway error reason if a payment fails.
 * 4. On `handler(response)`, sends `razorpay_payment_id`, `razorpay_order_id`, and `razorpay_signature` to `POST /api/v1/payments/verify-checkout`,
 *    where the backend verifies `hmac_sha256(stored_order_id + "|" + razorpay_payment_id, RAZORPAY_KEY_SECRET) == razorpay_signature`
 *    and automatically transitions the installment to `PAID ✓`.
 */
export function RazorpayInstallmentPayButton({
  enrollmentId,
  sequenceNumber,
  installmentSequenceNumber,
  amount,
  amountInr,
  compact = false,
  buttonLabel,
  onPaymentSuccess,
}: RazorpayInstallmentPayButtonProps) {
  const resolvedSequenceNumber = sequenceNumber ?? installmentSequenceNumber ?? 1;
  const resolvedAmountInr = amount ?? amountInr ?? '0.00';

  const createOrderMutation = useCreatePaymentOrderMutation();
  const verifyCheckoutMutation = useVerifyRazorpayCheckoutMutation();
  const [gatewayError, setGatewayError] = useState<string | null>(null);
  const [loadingScript, setLoadingScript] = useState(false);

  const handlePayWithRazorpay = async () => {
    setGatewayError(null);
    setLoadingScript(true);

    const scriptLoaded = await loadRazorpayStandardCheckoutScript();
    setLoadingScript(false);

    if (!scriptLoaded || !window.Razorpay) {
      setGatewayError(
        'Unable to load https://checkout.razorpay.com/v1/checkout.js. Please check your internet connection or ad-blocker.'
      );
      return;
    }

    createOrderMutation.mutate(
      {
        enrollmentId,
        installmentSequenceNumber: resolvedSequenceNumber,
        useWalletBalance: false,
        idempotencyKey: `rcpt_${enrollmentId.slice(0, 8)}_inst${resolvedSequenceNumber}_${Date.now()
          .toString()
          .slice(-6)}`,
      },
      {
        onSuccess: (orderData) => {
          if (orderData.paidViaWallet) {
            onPaymentSuccess?.();
            return;
          }

          if (!orderData.providerOrderId || !orderData.razorpayKeyId) {
            setGatewayError(
              'Backend did not return a valid Razorpay order_id or key_id. Check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend/.env.'
            );
            return;
          }

          const options: Record<string, unknown> = {
            key: orderData.razorpayKeyId, // Enter the Key ID generated from the Razorpay Dashboard
            amount: String(orderData.amountInPaise), // Amount in currency subunits (paise)
            currency: orderData.currency || 'INR',
            name: 'Saampark Institute LMS',
            description: `${orderData.courseCode} Installment ${orderData.installmentSequenceNumber}`,
            order_id: orderData.providerOrderId, // Real order_id created via Razorpay Orders API
            prefill: {
              name: orderData.studentName,
              email: orderData.studentEmail,
              contact: formatPhoneForRazorpayPrefill(orderData.studentPhone),
            },
            notes: {
              enrollmentId: orderData.enrollmentId,
              installmentSequenceNumber: String(orderData.installmentSequenceNumber),
              courseCode: orderData.courseCode,
            },
            theme: {
              color: '#0B5CFF',
            },
            modal: {
              confirm_close: true,
            },
            handler: function (response: {
              razorpay_payment_id: string;
              razorpay_order_id: string;
              razorpay_signature: string;
            }) {
              verifyCheckoutMutation.mutate(
                {
                  enrollmentId: orderData.enrollmentId,
                  installmentSequenceNumber: orderData.installmentSequenceNumber,
                  razorpayOrderId: response.razorpay_order_id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature,
                },
                {
                  onSuccess: () => {
                    setGatewayError(null);
                    onPaymentSuccess?.();
                  },
                  onError: (err) => {
                    setGatewayError(extractErrorMessage(err));
                  },
                }
              );
            },
          };

          const rzp1 = new window.Razorpay!(options);

          rzp1.on('payment.failed', function (response) {
            const err = response?.error;
            setGatewayError(
              `Razorpay Payment Failed: ${
                err?.description || 'Transaction declined'
              } (${err?.reason || err?.code || 'ERR'})`
            );
          });

          rzp1.open();
        },
        onError: (err) => {
          setGatewayError(extractErrorMessage(err));
        },
      }
    );
  };

  const isBusy =
    loadingScript ||
    createOrderMutation.isPending ||
    verifyCheckoutMutation.isPending;

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        disabled={isBusy}
        onClick={() => void handlePayWithRazorpay()}
        className={`${
          compact ? 'px-3 py-1.5 text-[11px]' : 'w-full py-2 px-3.5 text-xs'
        } rounded-xl bg-gradient-to-r from-[#0B5CFF] via-blue-600 to-cyan-500 text-white font-bold shadow-md hover:opacity-95 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50`}
      >
        <CreditCard className="w-3.5 h-3.5 shrink-0" />
        <span>
          {loadingScript
            ? 'Loading Razorpay SDK...'
            : createOrderMutation.isPending
            ? 'Creating Razorpay Order...'
            : verifyCheckoutMutation.isPending
            ? 'Verifying Signature...'
            : buttonLabel || `Pay ₹${resolvedAmountInr} with Razorpay`}
        </span>
      </button>

      {gatewayError && (
        <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 dark:text-rose-300 text-[11px] flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{gatewayError}</span>
        </div>
      )}
    </div>
  );
}
