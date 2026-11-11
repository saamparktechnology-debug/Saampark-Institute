import { PhaseModuleStatusView } from '@/features/dashboards';

export default function StudentDynamicSectionPage({
  params,
}: {
  params: { section: string };
}) {
  return <PhaseModuleStatusView role="STUDENT" sectionSlug={params.section} />;
}
