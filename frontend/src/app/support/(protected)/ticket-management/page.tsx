import { SupportCommandWorkspaceView } from '@/features/operations';

export default function SupportTicketManagementPage() {
  return (
    <SupportCommandWorkspaceView
      viewMode="TRIAGE"
      headerTitle="Ticket Management & Kanban Queue"
    />
  );
}
