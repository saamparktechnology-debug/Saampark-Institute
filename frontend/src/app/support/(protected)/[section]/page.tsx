import { PhaseModuleStatusView } from '@/features/dashboards';

export default function SupportDynamicSectionPage({
  params,
}: {
  params: { section: string };
}) {
  return <PhaseModuleStatusView role="SUPPORT" sectionSlug={params.section} />;
}
