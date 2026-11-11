import { SupportCommandWorkspaceView } from '@/features/operations';

export default function SupportPaymentIssuesPage() {
  return (
    <SupportCommandWorkspaceView
      initialCategory="PAYMENT_ISSUE"
      headerTitle="Payment & Billing Issues Triage"
    />
  );
}
