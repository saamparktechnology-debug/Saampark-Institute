'use client';

import React from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ShieldCheck, Lock, Mail, ArrowRight, Sun, Moon, AlertCircle } from 'lucide-react';
import { RolePanelType } from '../types/auth.types';
import { ROLE_PORTAL_CONFIG } from '../auth.constant';
import { useRoleLoginMutation } from '../hooks/auth.hook';
import { useTheme } from '@/providers/AppProviders';

const loginFormSchema = z.object({
  email: z.string().trim().email('Please enter a valid institutional email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginFormValues = z.infer<typeof loginFormSchema>;

export function RoleLoginCard({ rolePanel }: { rolePanel: RolePanelType }) {
  const meta = ROLE_PORTAL_CONFIG[rolePanel];
  const { theme, toggleTheme } = useTheme();
  const loginMutation = useRoleLoginMutation();
  const isDark = theme === 'dark';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: meta.demoEmail,
      password: 'Password123!',
    },
  });

  const onSubmit = (values: LoginFormValues) => {
    loginMutation.mutate({
      email: values.email,
      password: values.password,
      rolePanel,
    });
  };

  return (
    <div
      style={{
        backgroundColor: isDark ? '#090D16' : '#F1F5F9',
        color: isDark ? '#F8FAFC' : '#0F172A',
      }}
      className="min-h-screen flex flex-col justify-between argon-shell-bg transition-colors duration-300 p-6"
    >
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`h-10 w-10 rounded-xl bg-gradient-to-br ${meta.accentGradient} flex items-center justify-center text-white font-bold shadow-lg`}
          >
            GA
          </div>
          <div>
            <span className="font-bold tracking-tight text-lg">Gemini Argon LMS</span>
            <span className="block text-xs text-slate-500 dark:text-slate-400">
              Single-Institute Modular Learning Platform
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <nav
            style={{
              backgroundColor: isDark ? '#111827' : '#FFFFFF',
              borderColor: isDark ? '#1E293B' : '#CBD5E1',
            }}
            className="hidden md:flex items-center gap-1 border rounded-xl p-1 text-xs"
          >
            {(['ADMIN', 'STUDENT', 'TEACHER', 'SUPPORT'] as RolePanelType[]).map((r) => (
              <Link
                key={r}
                href={ROLE_PORTAL_CONFIG[r].loginPath}
                className={`px-3 py-1.5 rounded-lg font-medium transition ${
                  r === rolePanel
                    ? isDark
                      ? 'bg-white text-slate-900'
                      : 'bg-slate-900 text-white'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {r} Login
              </Link>
            ))}
          </nav>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle Dark or Light Mode"
            style={{
              backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
              borderColor: isDark ? '#334155' : '#CBD5E1',
              color: isDark ? '#F8FAFC' : '#0F172A',
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold shadow-sm hover:opacity-90 transition cursor-pointer"
          >
            {isDark ? (
              <>
                <Sun className="w-4 h-4 text-amber-400" />
                <span>Light Mode</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-indigo-600" />
                <span>Dark Mode</span>
              </>
            )}
          </button>
        </div>
      </header>

      <main className="my-auto max-w-md w-full mx-auto">
        <div
          style={{
            backgroundColor: isDark ? '#111827' : '#FFFFFF',
            borderColor: isDark ? '#1E293B' : '#E2E8F0',
            color: isDark ? '#F8FAFC' : '#0F172A',
          }}
          className="rounded-2xl border backdrop-blur-xl shadow-2xl p-8 transition-colors duration-300"
        >
          <div
            style={{
              backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
              color: isDark ? '#E2E8F0' : '#334155',
            }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-4"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            {meta.badgeLabel}
          </div>

          <h1 className="text-2xl font-bold tracking-tight mb-2">{meta.portalTitle}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{meta.portalSubtitle}</p>

          {loginMutation.isError && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                {(loginMutation.error as { message?: string })?.message ||
                  'Authentication failed. Verify your role credentials.'}
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Institutional Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  {...register('email')}
                  style={{
                    backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
                    borderColor: isDark ? '#334155' : '#CBD5E1',
                    color: isDark ? '#F8FAFC' : '#0F172A',
                  }}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder={meta.demoEmail}
                />
              </div>
              {errors.email && (
                <p className="text-xs text-rose-500 mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="password"
                  {...register('password')}
                  style={{
                    backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
                    borderColor: isDark ? '#334155' : '#CBD5E1',
                    color: isDark ? '#F8FAFC' : '#0F172A',
                  }}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="••••••••••••"
                />
              </div>
              {errors.password && (
                <p className="text-xs text-rose-500 mt-1">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loginMutation.isPending}
              className={`w-full py-2.5 px-4 rounded-xl font-semibold text-sm text-white bg-gradient-to-r ${meta.accentGradient} hover:opacity-95 transition flex items-center justify-center gap-2 shadow-lg cursor-pointer`}
            >
              {loginMutation.isPending ? 'Verifying Role & Session...' : `Sign In to ${meta.role} Panel`}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div
            style={{ borderColor: isDark ? '#1E293B' : '#E2E8F0' }}
            className="mt-6 pt-5 border-t flex items-center justify-between text-xs text-slate-500"
          >
            <span>Server-enforced RBAC + HttpOnly session</span>
            <Link
              href={meta.dashboardPath}
              className="font-semibold text-violet-600 dark:text-violet-400 hover:underline"
            >
              Open {meta.role} Dashboard →
            </Link>
          </div>
        </div>
      </main>

      <footer className="max-w-6xl w-full mx-auto text-center text-xs text-slate-500">
        Protected by 5-Layer Authorization Middleware • Hostinger VPS Ready • Timezone: Asia/Kolkata
      </footer>
    </div>
  );
}
