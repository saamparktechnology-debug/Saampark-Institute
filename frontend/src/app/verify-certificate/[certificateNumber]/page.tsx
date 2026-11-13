import React from 'react';
import { PublicCertificateVerificationPortal } from '@/features/assessments/components/AssessmentsAndCertificatesViews';

export default async function VerifyCertificateByCodePage({
  params,
}: {
  params: Promise<{ certificateNumber: string }>;
}) {
  const resolved = await params;
  return (
    <PublicCertificateVerificationPortal
      initialCode={decodeURIComponent(resolved.certificateNumber || '')}
    />
  );
}
