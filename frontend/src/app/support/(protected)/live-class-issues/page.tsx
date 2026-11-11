import { SupportCommandWorkspaceView } from '@/features/operations';

export default function SupportLiveClassIssuesPage() {
  return (
    <SupportCommandWorkspaceView
      initialCategory="LIVE_CLASS_ISSUE"
      headerTitle="100ms Live Classroom Issues Triage"
    />
  );
}
