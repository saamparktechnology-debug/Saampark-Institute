'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sun,
  Moon,
  Search,
  Bell,
  LogOut,
  Shield,
  LayoutDashboard,
  ChevronRight,
} from 'lucide-react';
import { RolePanelType } from '@/features/auth/types/auth.types';
import { ROLE_PORTAL_CONFIG } from '@/features/auth/auth.constant';
import { useLogoutMutation } from '@/features/auth/hooks/auth.hook';
import { PANEL_SIDEBAR_NAVIGATION } from '../dashboards.constant';
import { useTheme } from '@/providers/AppProviders';

interface RolePanelShellProps {
  role: RolePanelType;
  operatorName: string;
  operatorSubtitle: string;
  headerTitle: string;
  children: React.ReactNode;
}

export function RolePanelShell({
  role,
  operatorName,
  operatorSubtitle,
  headerTitle,
  children,
}: RolePanelShellProps) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const sections = PANEL_SIDEBAR_NAVIGATION[role];
  const portalMeta = ROLE_PORTAL_CONFIG[role];
  const logoutMutation = useLogoutMutation(portalMeta.loginPath);

  const isDark = theme === 'dark';

  return (
    <div
      style={{
        backgroundColor: isDark ? '#090D16' : '#F1F5F9',
        color: isDark ? '#F8FAFC' : '#0F172A',
      }}
      className="min-h-screen flex argon-shell-bg transition-colors duration-300"
    >
      {/* Role-Specific Categorized Sidebar with Real Next.js Route Links */}
      <aside
        style={{
          backgroundColor: isDark ? '#0D1322' : '#FFFFFF',
          borderColor: isDark ? '#1E293B' : '#E2E8F0',
        }}
        className="w-64 shrink-0 border-r argon-sidebar-bg backdrop-blur-xl flex flex-col justify-between p-4 transition-colors duration-300"
      >
        <div>
          <div
            style={{
              backgroundColor: isDark ? '#111827' : '#F8FAFC',
              borderColor: isDark ? '#1E293B' : '#E2E8F0',
            }}
            className="flex items-center gap-3 p-2.5 rounded-xl border mb-5"
          >
            <div
              className={`h-10 w-10 rounded-full bg-gradient-to-br ${portalMeta.accentGradient} flex items-center justify-center text-white font-bold text-sm shadow-md`}
            >
              {operatorName.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {role} PANEL
              </p>
              <p className="text-sm font-semibold truncate">{operatorName}</p>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 truncate">
                • {operatorSubtitle}
              </p>
            </div>
          </div>

          <nav className="space-y-5 overflow-y-auto max-h-[calc(100vh-220px)] pr-1">
            {sections.map((sec) => (
              <div key={sec.heading}>
                <p className="px-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1.5">
                  {sec.heading}
                </p>
                <div className="space-y-1">
                  {sec.items.map((item) => {
                    const baseHref = item.href.split('?')[0];
                    const isActive = pathname === baseHref;
                    return (
                      <Link
                        key={item.key}
                        href={item.href}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition ${
                          isActive
                            ? `bg-gradient-to-r ${portalMeta.accentGradient} text-white shadow-md`
                            : isDark
                            ? 'text-slate-400 hover:bg-slate-800/70 hover:text-white'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <LayoutDashboard className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </span>
                        {item.badge ? (
                          <span
                            className={`px-1.5 py-0.5 text-[10px] rounded-full font-bold ${
                              isActive
                                ? 'bg-white/25 text-white'
                                : 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                            }`}
                          >
                            {item.badge}
                          </span>
                        ) : (
                          isActive && <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        <div
          style={{ borderColor: isDark ? '#1E293B' : '#E2E8F0' }}
          className="pt-4 border-t space-y-2"
        >
          <div className="flex items-center justify-between px-2 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-emerald-500" /> Scope Verified
            </span>
            <span>INR (₹)</span>
          </div>
          <button
            type="button"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition"
          >
            <LogOut className="w-4 h-4" />
            {logoutMutation.isPending ? 'Signing out...' : `Log Out (${role})`}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header
          style={{
            backgroundColor: isDark ? 'rgba(13, 19, 34, 0.88)' : 'rgba(255, 255, 255, 0.92)',
            borderColor: isDark ? '#1E293B' : '#E2E8F0',
          }}
          className="h-16 border-b backdrop-blur-md px-6 flex items-center justify-between gap-4 transition-colors duration-300"
        >
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold tracking-tight">{headerTitle}</h1>
            <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              RBAC Active: {role}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative hidden md:block">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search scoped records..."
                style={{
                  backgroundColor: isDark ? '#0F172A' : '#F1F5F9',
                  borderColor: isDark ? '#1E293B' : '#CBD5E1',
                  color: isDark ? '#F8FAFC' : '#0F172A',
                }}
                className="pl-8 pr-3 py-1.5 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>

            {/* Quick Panel Switcher */}
            <div
              style={{
                backgroundColor: isDark ? '#0F172A' : '#F1F5F9',
                borderColor: isDark ? '#1E293B' : '#CBD5E1',
              }}
              className="hidden lg:flex items-center gap-1 border rounded-xl p-1 text-[11px]"
            >
              {(['ADMIN', 'STUDENT', 'TEACHER', 'SUPPORT'] as RolePanelType[]).map((r) => (
                <Link
                  key={r}
                  href={ROLE_PORTAL_CONFIG[r].dashboardPath}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                    r === role
                      ? isDark
                        ? 'bg-white text-slate-900'
                        : 'bg-slate-900 text-white'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {r}
                </Link>
              ))}
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              style={{
                backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                borderColor: isDark ? '#334155' : '#CBD5E1',
                color: isDark ? '#F8FAFC' : '#0F172A',
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold shadow-sm hover:opacity-90 transition cursor-pointer"
            >
              {isDark ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span>Switch to Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Switch to Dark</span>
                </>
              )}
            </button>

            <button
              type="button"
              aria-label="Notifications"
              style={{
                backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                borderColor: isDark ? '#334155' : '#CBD5E1',
              }}
              className="p-2 rounded-xl border relative"
            >
              <Bell className="w-4 h-4" />
              <span className="h-2 w-2 rounded-full bg-rose-500 absolute top-1.5 right-1.5" />
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
