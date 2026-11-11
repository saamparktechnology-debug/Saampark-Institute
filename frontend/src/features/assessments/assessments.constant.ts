export const SUBMISSION_DECISION_OPTIONS = [
  { label: 'Graded & Approved', value: 'GRADED' },
  { label: 'Request Resubmission', value: 'RESUBMIT_REQUESTED' },
] as const;

export const EXAM_DURATION_PRESETS = [
  { label: '30 Minutes', value: 1800 },
  { label: '60 Minutes (1 Hour)', value: 3600 },
  { label: '90 Minutes', value: 5400 },
  { label: '120 Minutes (2 Hours)', value: 7200 },
] as const;
