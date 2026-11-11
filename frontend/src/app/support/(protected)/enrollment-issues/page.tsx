import { SupportCommandWorkspaceView } from '@/features/operations';

export default function SupportEnrollmentIssuesPage() {
  return (
    <SupportCommandWorkspaceView
      initialCategory="ENROLLMENT_ISSUE"
      headerTitle="Enrollment & Installment Issues Triage"
    />
  );
}
