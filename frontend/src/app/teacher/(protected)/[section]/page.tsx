import { PhaseModuleStatusView } from '@/features/dashboards';

export default function TeacherDynamicSectionPage({
  params,
}: {
  params: { section: string };
}) {
  return <PhaseModuleStatusView role="TEACHER" sectionSlug={params.section} />;
}
