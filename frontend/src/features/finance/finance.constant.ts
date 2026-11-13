export const PAYMENT_PROVIDERS = [
  { label: 'Razorpay Gateway', value: 'RAZORPAY' },
  { label: 'Wallet Balance', value: 'WALLET' },
  { label: 'Manual / Bank Transfer', value: 'MANUAL' },
] as const;

export const REDEMPTION_MIN_INR = 100;
export const REDEMPTION_MAX_INR = 100000;
