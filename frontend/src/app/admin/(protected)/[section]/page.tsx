import { PhaseModuleStatusView } from '@/features/dashboards';

export default function AdminDynamicSectionPage({
  params,
}: {
  params: { section: string };
}) {
  return <PhaseModuleStatusView role="ADMIN" sectionSlug={params.section} />;
}
