export const LIVE_CLASS_STATUS_OPTIONS = [
  { label: 'Scheduled', value: 'SCHEDULED' },
  { label: 'Live Now', value: 'LIVE' },
  { label: 'Ended', value: 'ENDED' },
  { label: 'Cancelled', value: 'CANCELLED' },
] as const;

export const ATTENDANCE_MARK_STATUS_OPTIONS = [
  { label: 'Present', value: 'PRESENT' },
  { label: 'Late', value: 'LATE' },
  { label: 'Absent', value: 'ABSENT' },
  { label: 'Excused', value: 'EXCUSED' },
] as const;

export const ATTENDANCE_EXPIRY_PRESETS = [
  { label: '5 Minutes', value: 5 },
  { label: '10 Minutes (Default)', value: 10 },
  { label: '15 Minutes', value: 15 },
  { label: '30 Minutes', value: 30 },
] as const;
