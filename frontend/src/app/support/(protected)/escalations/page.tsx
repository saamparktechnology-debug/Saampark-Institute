import { SupportCommandWorkspaceView } from '@/features/operations';

export default function SupportEscalationsPage() {
  return (
    <SupportCommandWorkspaceView
      initialStatus="ESCALATED"
      viewMode="ESCALATIONS"
      headerTitle="Escalation Management & SLA Breach Monitor"
    />
  );
}
