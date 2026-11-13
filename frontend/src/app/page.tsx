import Link from 'next/link';
import { ROLE_PORTAL_CONFIG } from '@/features/auth';
import { RolePanelType } from '@/features/auth/types/auth.types';

export default function HomePage() {
  const roles: RolePanelType[] = ['ADMIN', 'STUDENT', 'TEACHER', 'SUPPORT'];

  return (
    <main className="min-h-screen flex flex-col justify-center items-center p-6 bg-slate-50 dark:bg-[#090D16] text-slate-900 dark:text-slate-100">
      <div className="max-w-4xl w-full text-center space-y-6">
        <span className="px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-widest bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          All Phases Complete — Production Ready (v1.2)
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
          Gemini Argon — Online Learning Platform
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
          Select one of the four dedicated role login portals, open its live Dark/Light mode dashboard experience, or verify an issued course certificate publicly.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 text-left">
          {roles.map((role) => {
            const cfg = ROLE_PORTAL_CONFIG[role];
            return (
              <div
                key={role}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-md flex flex-col justify-between"
              >
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    {cfg.badgeLabel}
                  </span>
                  <h2 className="text-lg font-bold mt-1">{cfg.portalTitle}</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-5">
                    {cfg.portalSubtitle}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    href={cfg.loginPath}
                    className={`px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r ${cfg.accentGradient}`}
                  >
                    {cfg.loginPath}
                  </Link>
                  <Link
                    href={cfg.dashboardPath}
                    className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    {cfg.dashboardPath}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-4">
          <Link
            href="/verify-certificate?code=CERT-ARGON-2026-PHYS401-0042"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/25 transition"
          >
            🔍 Public Certificate Verification Portal (`/verify-certificate`) →
          </Link>
        </div>
      </div>
    </main>
  );
}
