export const PAYMENT_STATUS_FILTERS = [
  { label: 'All Statuses', value: '' },
  { label: 'Captured (Verified)', value: 'CAPTURED' },
  { label: 'Created / Pending', value: 'CREATED' },
  { label: 'Refunded', value: 'REFUNDED' },
  { label: 'Failed', value: 'FAILED' },
] as const;

export const REDEMPTION_MIN_AMOUNT_INR = 100;
export const REDEMPTION_MAX_AMOUNT_INR = 100000;
