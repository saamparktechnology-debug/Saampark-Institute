'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Sun,
  Moon,
  Search,
  Bell,
  LogOut,
  Shield,
  LayoutDashboard,
  ChevronRight,
  CheckCircle2,
  MessageSquare,
  Mail,
  Sparkles,
  BookOpen,
  PlayCircle,
} from 'lucide-react';
import { RolePanelType } from '@/features/auth/types/auth.types';
import { ROLE_PORTAL_CONFIG } from '@/features/auth/auth.constant';
import { useAuthProfileQuery, useLogoutMutation } from '@/features/auth/hooks/auth.hook';
import {
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
  useNotificationsQuery,
} from '@/features/operations/hooks/operations.hook';
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
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [currentSearch, setCurrentSearch] = useState('');

  const { data: authProfile } = useAuthProfileQuery();
  const { data: notificationsData } = useNotificationsQuery();
  const markReadMutation = useMarkNotificationReadMutation();
  const markAllReadMutation = useMarkAllNotificationsReadMutation();

  const sections = PANEL_SIDEBAR_NAVIGATION[role];
  const portalMeta = ROLE_PORTAL_CONFIG[role];
  const logoutMutation = useLogoutMutation(portalMeta.loginPath);

  const isDark = theme === 'dark';

  // Track query string changes so sidebar links like /admin/users?role=TEACHER highlight accurately
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentSearch(window.location.search || '');
    }
  }, [pathname]);

  const resolvedOperatorName =
    authProfile && authProfile.role === role ? authProfile.fullName : operatorName;
  const resolvedOperatorSubtitle =
    authProfile && authProfile.role === role ? authProfile.email : operatorSubtitle;

  // Strip any technical route or requirement tags from student-facing header titles
  const cleanHeaderTitle =
    role === 'STUDENT'
      ? headerTitle.replace(/\s*\([^)]*\)/g, '').replace(/\s*—\s*Learning & Finance Telemetry/i, '')
      : headerTitle;

  const flatNavItems = useMemo(
    () =>
      sections.flatMap((sec) =>
        sec.items.map((item) => ({
          ...item,
          sectionHeading: sec.heading,
        }))
      ),
    [sections]
  );

  const filteredNavItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return flatNavItems.slice(0, 6);
    return flatNavItems.filter(
      (i) =>
        i.label.toLowerCase().includes(q) ||
        i.sectionHeading.toLowerCase().includes(q) ||
        i.href.toLowerCase().includes(q)
    );
  }, [flatNavItems, searchTerm]);

  const unreadCount = notificationsData?.unreadCount ?? 0;
  const recentNotifications = (notificationsData?.items ?? []).slice(0, 6);

  return (
    <div
      style={{
        backgroundColor: isDark ? '#090D16' : '#F8FAFC',
        color: isDark ? '#F8FAFC' : '#0F172A',
      }}
      className="min-h-screen flex argon-shell-bg transition-colors duration-300"
    >
      {/* Role-Specific Categorized Sidebar */}
      <aside
        style={{
          backgroundColor: isDark ? '#0D1322' : '#FFFFFF',
          borderColor: isDark ? '#1E293B' : '#E2E8F0',
        }}
        className="w-60 shrink-0 border-r argon-sidebar-bg backdrop-blur-xl flex flex-col justify-between p-4 transition-colors duration-300"
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
              className={`h-9 w-9 rounded-xl bg-gradient-to-br ${portalMeta.accentGradient} flex items-center justify-center text-white font-bold text-xs shadow-md shrink-0`}
            >
              {resolvedOperatorName.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-violet-500 dark:text-violet-400">
                {role === 'STUDENT' ? 'STUDENT LEARNING' : `${role} PANEL`}
              </p>
              <p className="text-xs font-bold truncate">{resolvedOperatorName}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {resolvedOperatorSubtitle}
              </p>
            </div>
          </div>

          <nav className="space-y-4 overflow-y-auto max-h-[calc(100vh-210px)] pr-1">
            {sections.map((sec) => (
              <div key={sec.heading}>
                <p className="px-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">
                  {sec.heading}
                </p>
                <div className="space-y-0.5">
                  {sec.items.map((item) => {
                    const [baseHref, itemQuery] = item.href.split('?');
                    const currentQueryClean = currentSearch.replace(/^\?/, '');

                    let isActive = false;
                    if (pathname === baseHref) {
                      if (itemQuery) {
                        isActive = currentQueryClean === itemQuery;
                      } else {
                        const siblingHasMatchingQuery = sec.items.some((sib) => {
                          const [sibBase, sibQ] = sib.href.split('?');
                          return sibBase === baseHref && sibQ && sibQ === currentQueryClean;
                        });
                        isActive = !siblingHasMatchingQuery;
                      }
                    }

                    return (
                      <Link
                        key={item.key}
                        href={item.href}
                        onClick={() => setCurrentSearch(itemQuery ? `?${itemQuery}` : '')}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition ${
                          isActive
                            ? `bg-gradient-to-r ${portalMeta.accentGradient} text-white shadow-sm`
                            : isDark
                            ? 'text-slate-400 hover:bg-slate-800/70 hover:text-white'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        <span className="flex items-center gap-2 truncate">
                          {role === 'STUDENT' ? (
                            <BookOpen className="w-3.5 h-3.5 shrink-0" />
                          ) : (
                            <LayoutDashboard className="w-3.5 h-3.5 shrink-0" />
                          )}
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
          className="pt-3 border-t space-y-2"
        >
          {role !== 'STUDENT' && (
            <div className="flex items-center justify-between px-2 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-emerald-500" /> Scope Verified
              </span>
              <span>INR (₹)</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            {logoutMutation.isPending ? 'Signing out...' : 'Sign Out'}
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
          className="h-15 border-b backdrop-blur-md px-6 flex items-center justify-between gap-4 transition-colors duration-300 relative z-30"
        >
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-base sm:text-lg font-bold tracking-tight truncate">
              {cleanHeaderTitle}
            </h1>
            {role === 'STUDENT' ? (
              <div className="hidden md:flex items-center gap-1.5 ml-2">
                <Link
                  href="/student/courses"
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold text-violet-600 dark:text-violet-400 bg-violet-500/10 hover:bg-violet-500/20 flex items-center gap-1"
                >
                  <PlayCircle className="w-3.5 h-3.5" /> Classroom
                </Link>
                <Link
                  href="/student/live-classes"
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800"
                >
                  Live Classes
                </Link>
              </div>
            ) : (
              <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                RBAC Active: {role}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {/* Global Search */}
            <div className="relative hidden md:block">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onFocus={() => {
                  setSearchOpen(true);
                  setBellOpen(false);
                }}
                onBlur={() => setTimeout(() => setSearchOpen(false), 180)}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setSearchOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && filteredNavItems.length > 0) {
                    router.push(filteredNavItems[0].href);
                    setSearchOpen(false);
                  }
                }}
                placeholder={
                  role === 'STUDENT' ? 'Search courses, videos, exams...' : 'Quick-jump modules...'
                }
                style={{
                  backgroundColor: isDark ? '#0F172A' : '#F1F5F9',
                  borderColor: isDark ? '#1E293B' : '#CBD5E1',
                  color: isDark ? '#F8FAFC' : '#0F172A',
                }}
                className="pl-8 pr-3 py-1.5 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-violet-500 w-56"
              />

              {searchOpen && (
                <div
                  style={{
                    backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
                    borderColor: isDark ? '#1E293B' : '#CBD5E1',
                    color: isDark ? '#F8FAFC' : '#0F172A',
                  }}
                  className="absolute right-0 mt-2 w-72 rounded-2xl border shadow-2xl p-2 space-y-1 z-50"
                >
                  <p className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                    <span>Quick Navigation</span>
                    <span>Enter ↵</span>
                  </p>
                  {filteredNavItems.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-slate-400">No matching page found.</p>
                  ) : (
                    filteredNavItems.map((item) => (
                      <Link
                        key={item.key}
                        href={item.href}
                        onClick={() => {
                          const [, q] = item.href.split('?');
                          setCurrentSearch(q ? `?${q}` : '');
                          setSearchOpen(false);
                        }}
                        className="flex items-center justify-between px-3 py-2 rounded-xl text-xs hover:bg-violet-500/15 transition"
                      >
                        <div>
                          <p className="font-semibold">{item.label}</p>
                          <p className="text-[10px] text-slate-400">{item.sectionHeading}</p>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      </Link>
                    ))
                  )}
                </div>
              )}
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
                  <span className="hidden sm:inline">Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="hidden sm:inline">Dark</span>
                </>
              )}
            </button>

            {/* Notification Bell Popover */}
            <div className="relative">
              <button
                type="button"
                aria-label="Notifications"
                onClick={() => {
                  setBellOpen((prev) => !prev);
                  setSearchOpen(false);
                }}
                style={{
                  backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                  borderColor: isDark ? '#334155' : '#CBD5E1',
                  color: isDark ? '#F8FAFC' : '#0F172A',
                }}
                className="p-2 rounded-xl border relative cursor-pointer hover:opacity-90 transition"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center absolute -top-1 -right-1">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {bellOpen && (
                <div
                  style={{
                    backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
                    borderColor: isDark ? '#1E293B' : '#CBD5E1',
                    color: isDark ? '#F8FAFC' : '#0F172A',
                  }}
                  className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border shadow-2xl p-4 space-y-3 z-50"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
                    <div>
                      <p className="text-xs font-bold flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-violet-400" /> Notifications (
                        {unreadCount} Unread)
                      </p>
                    </div>

                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={() => markAllReadMutation.mutate()}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-600 text-white cursor-pointer"
                      >
                        Mark All Read
                      </button>
                    )}
                  </div>

                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {recentNotifications.length === 0 ? (
                      <p className="text-xs text-slate-400 py-4 text-center">
                        No notifications received yet.
                      </p>
                    ) : (
                      recentNotifications.map((n) => {
                        const ch =
                          n.deliveryChannel ||
                          (n.type.startsWith('WHATSAPP_') ? 'WHATSAPP' : n.channel);
                        return (
                          <div
                            key={n.id}
                            className={`p-2.5 rounded-xl border text-xs flex items-start justify-between gap-2 ${
                              n.readAt
                                ? 'border-slate-200 dark:border-slate-800 opacity-70'
                                : 'border-violet-500/40 bg-violet-500/10'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                {ch === 'WHATSAPP' ? (
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold text-[10px] inline-flex items-center gap-1">
                                    <MessageSquare className="w-2.5 h-2.5" /> WhatsApp
                                  </span>
                                ) : ch === 'EMAIL' ? (
                                  <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 font-bold text-[10px] inline-flex items-center gap-1">
                                    <Mail className="w-2.5 h-2.5" /> Email
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-400 font-bold text-[10px]">
                                    In-App
                                  </span>
                                )}
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {new Date(n.sentAt).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
                              <p className="font-bold mt-1 truncate">{n.title}</p>
                              <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">
                                {n.body}
                              </p>
                            </div>

                            {!n.readAt ? (
                              <button
                                type="button"
                                onClick={() => markReadMutation.mutate(n.id)}
                                className="px-2 py-1 rounded-lg bg-violet-600 text-white text-[10px] font-bold shrink-0 cursor-pointer"
                              >
                                Read
                              </button>
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-1" />
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px]">
                    <Link
                      href={
                        role === 'ADMIN'
                          ? '/admin/settings'
                          : `/${role.toLowerCase()}/notifications`
                      }
                      onClick={() => setBellOpen(false)}
                      className="font-bold text-violet-400 hover:underline"
                    >
                      View All Notifications →
                    </Link>
                    <button
                      type="button"
                      onClick={() => setBellOpen(false)}
                      className="text-slate-400 hover:underline cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-5 sm:p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
