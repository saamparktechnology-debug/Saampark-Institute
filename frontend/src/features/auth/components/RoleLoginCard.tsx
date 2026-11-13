'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ShieldCheck,
  Lock,
  Mail,
  ArrowRight,
  Sun,
  Moon,
  AlertCircle,
  UserPlus,
  Phone,
  Gift,
  User,
  KeyRound,
  CheckCircle2,
  Smartphone,
} from 'lucide-react';
import { RolePanelType } from '../types/auth.types';
import { ROLE_PORTAL_CONFIG } from '../auth.constant';
import {
  useLoginWithOtpMutation,
  useRequestOtpMutation,
  useResetPasswordWithOtpMutation,
  useRoleLoginMutation,
  useStudentRegisterMutation,
} from '../hooks/auth.hook';
import { useTheme } from '@/providers/AppProviders';

const loginFormSchema = z.object({
  email: z.string().trim().email('Please enter a valid institutional email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginFormValues = z.infer<typeof loginFormSchema>;

const studentSignupSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required').max(150),
  email: z.string().trim().email('Valid email is required'),
  phone: z.string().trim().min(8, 'Valid WhatsApp/mobile number is required').max(20),
  password: z
    .string()
    .min(8, 'At least 8 characters')
    .regex(/[A-Z]/, 'Include at least 1 uppercase letter')
    .regex(/[0-9]/, 'Include at least 1 number'),
  referralCode: z.string().trim().max(32).optional(),
});

type StudentSignupValues = z.infer<typeof studentSignupSchema>;

export function RoleLoginCard({ rolePanel }: { rolePanel: RolePanelType }) {
  const meta = ROLE_PORTAL_CONFIG[rolePanel];
  const { theme, toggleTheme } = useTheme();
  const loginMutation = useRoleLoginMutation();
  const registerMutation = useStudentRegisterMutation();
  const requestOtpMutation = useRequestOtpMutation();
  const resetPasswordOtpMutation = useResetPasswordWithOtpMutation();
  const loginWithOtpMutation = useLoginWithOtpMutation();

  const [authTab, setAuthTab] = useState<'LOGIN' | 'REGISTER' | 'FORGOT_OR_OTP'>('LOGIN');
  const [otpMode, setOtpMode] = useState<'PASSWORD_RESET' | 'OTP_LOGIN'>('PASSWORD_RESET');
  const [otpEmail, setOtpEmail] = useState<string>('');
  const [otpCode, setOtpCode] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [otpStatusBanner, setOtpStatusBanner] = useState<string | null>(null);
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);
  const [referralInviteBanner, setReferralInviteBanner] = useState<string | null>(null);

  const isDark = theme === 'dark';

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const signupForm = useForm<StudentSignupValues>({
    resolver: zodResolver(studentSignupSchema),
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      password: '',
      referralCode: '',
    },
  });

  // Automatically detect ?ref=ARGON-... or ?referralCode=... or ?tab=REGISTER on /student/login
  useEffect(() => {
    if (typeof window === 'undefined' || rolePanel !== 'STUDENT') return;
    const params = new URLSearchParams(window.location.search);
    const refParam = (params.get('ref') || params.get('referralCode') || '').trim().toUpperCase();
    const tabParam = (params.get('tab') || '').trim().toUpperCase();

    if (refParam) {
      setAuthTab('REGISTER');
      signupForm.setValue('referralCode', refParam);
      setReferralInviteBanner(
        `Referral invitation applied (${refParam}). Create your student account below to link your enrollment reward!`
      );
    } else if (tabParam === 'REGISTER' || tabParam === 'SIGNUP') {
      setAuthTab('REGISTER');
    }
  }, [rolePanel, signupForm]);

  const onSubmitLogin = (values: LoginFormValues) => {
    loginMutation.mutate({
      email: values.email,
      password: values.password,
      rolePanel,
    });
  };

  const onSubmitSignup = (values: StudentSignupValues) => {
    registerMutation.mutate({
      fullName: values.fullName,
      email: values.email,
      phone: values.phone,
      password: values.password,
      referralCode: values.referralCode || undefined,
    });
  };

  const handleRequestOtp = () => {
    setOtpStatusBanner(null);
    setDevOtpHint(null);
    requestOtpMutation.mutate(
      {
        email: otpEmail.trim(),
        rolePanel,
        purpose: otpMode,
      },
      {
        onSuccess: (res) => {
          setOtpStatusBanner(
            `6-digit OTP sent to ${res.email} via ${
              res.channelsDispatched.join(' + ') || 'Email/WhatsApp'
            } (Valid until ${new Date(res.expiresAt).toLocaleTimeString()}).`
          );
          if (res.devOtpPreview) {
            setDevOtpHint(res.devOtpPreview);
            setOtpCode(res.devOtpPreview);
          }
        },
      }
    );
  };

  const handleVerifyOtpAction = (e: React.FormEvent) => {
    e.preventDefault();
    if (otpMode === 'OTP_LOGIN') {
      loginWithOtpMutation.mutate({
        email: otpEmail.trim(),
        rolePanel,
        otp: otpCode.trim(),
      });
    } else {
      resetPasswordOtpMutation.mutate(
        {
          email: otpEmail.trim(),
          rolePanel,
          otp: otpCode.trim(),
          newPassword,
        },
        {
          onSuccess: () => {
            setOtpStatusBanner(
              'Password reset complete! All previous device sessions were revoked. You can now sign in with your new password.'
            );
            setTimeout(() => {
              setAuthTab('LOGIN');
            }, 1400);
          },
        }
      );
    }
  };

  const activeError =
    authTab === 'LOGIN'
      ? loginMutation.error
      : authTab === 'REGISTER'
      ? registerMutation.error
      : requestOtpMutation.error ||
        resetPasswordOtpMutation.error ||
        loginWithOtpMutation.error;
  const isError =
    authTab === 'LOGIN'
      ? loginMutation.isError
      : authTab === 'REGISTER'
      ? registerMutation.isError
      : requestOtpMutation.isError ||
        resetPasswordOtpMutation.isError ||
        loginWithOtpMutation.isError;

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

      <main className="my-auto max-w-md w-full mx-auto py-6">
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
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">{meta.portalSubtitle}</p>

          {/* Top Mode Switcher: Password Login / Student Sign Up / Forgot Password & OTP Login */}
          <div
            className={`grid ${
              rolePanel === 'STUDENT' ? 'grid-cols-3' : 'grid-cols-2'
            } gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 mb-5 text-xs`}
          >
            <button
              type="button"
              onClick={() => setAuthTab('LOGIN')}
              className={`py-2 px-2.5 rounded-lg font-bold transition cursor-pointer ${
                authTab === 'LOGIN'
                  ? 'bg-gradient-to-r from-violet-500 to-cyan-500 text-white shadow'
                  : 'text-slate-500'
              }`}
            >
              Password Login
            </button>

            {rolePanel === 'STUDENT' && (
              <button
                type="button"
                onClick={() => setAuthTab('REGISTER')}
                className={`py-2 px-2.5 rounded-lg font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                  authTab === 'REGISTER'
                    ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow'
                    : 'text-slate-500'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" /> Sign Up
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                const currentEmail = getValues('email');
                if (currentEmail) setOtpEmail(currentEmail);
                setAuthTab('FORGOT_OR_OTP');
              }}
              className={`py-2 px-2.5 rounded-lg font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                authTab === 'FORGOT_OR_OTP'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow'
                  : 'text-slate-500'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" /> OTP / Reset
            </button>
          </div>

          {referralInviteBanner && authTab === 'REGISTER' && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-600 dark:text-emerald-300 text-xs flex items-start gap-2.5">
              <Gift className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
              <span>{referralInviteBanner}</span>
            </div>
          )}

          {isError && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                {(activeError as { message?: string })?.message ||
                  'Authentication failed. Verify your credentials.'}
              </span>
            </div>
          )}

          {authTab === 'LOGIN' && (
            <form onSubmit={handleSubmit(onSubmitLogin)} className="space-y-4" noValidate>
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
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const currentEmail = getValues('email');
                      if (currentEmail) setOtpEmail(currentEmail);
                      setOtpMode('PASSWORD_RESET');
                      setAuthTab('FORGOT_OR_OTP');
                    }}
                    className="text-xs font-semibold text-cyan-500 hover:underline cursor-pointer"
                  >
                    Forgot Password / Login via OTP?
                  </button>
                </div>
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

              {rolePanel === 'STUDENT' && (
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 flex items-center gap-2">
                  <Smartphone className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>
                    Anti-Piracy Guard: Maximum <strong>2 active device sessions</strong> (1 Web + 1 Mobile) allowed per student.
                  </span>
                </div>
              )}

              <button
                type="submit"
                disabled={loginMutation.isPending}
                className={`w-full py-2.5 px-4 rounded-xl font-semibold text-sm text-white bg-gradient-to-r ${meta.accentGradient} hover:opacity-95 transition flex items-center justify-center gap-2 shadow-lg cursor-pointer`}
              >
                {loginMutation.isPending
                  ? 'Verifying Role & Session...'
                  : `Sign In to ${meta.role} Panel`}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {authTab === 'FORGOT_OR_OTP' && (
            <form onSubmit={handleVerifyOtpAction} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setOtpMode('PASSWORD_RESET')}
                  className={`py-1.5 px-2 rounded-lg font-bold cursor-pointer ${
                    otpMode === 'PASSWORD_RESET'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400'
                  }`}
                >
                  Reset Password via OTP
                </button>
                <button
                  type="button"
                  onClick={() => setOtpMode('OTP_LOGIN')}
                  className={`py-1.5 px-2 rounded-lg font-bold cursor-pointer ${
                    otpMode === 'OTP_LOGIN'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400'
                  }`}
                >
                  Sign In with 6-Digit OTP
                </button>
              </div>

              <div>
                <label className="block font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Registered Email Address
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    required
                    value={otpEmail}
                    onChange={(e) => setOtpEmail(e.target.value)}
                    placeholder={meta.demoEmail}
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                  />
                  <button
                    type="button"
                    disabled={!otpEmail.trim() || requestOtpMutation.isPending}
                    onClick={handleRequestOtp}
                    className="px-3 py-2 rounded-xl font-bold bg-cyan-600 text-white shrink-0 cursor-pointer"
                  >
                    {requestOtpMutation.isPending ? 'Sending...' : 'Send 6-Digit OTP'}
                  </button>
                </div>
              </div>

              {otpStatusBanner && (
                <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 space-y-1">
                  <p className="font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{otpStatusBanner}</span>
                  </p>
                  {devOtpHint && (
                    <p className="font-mono text-[11px] text-amber-300">
                      Dev/Sandbox OTP Preview: <strong>{devOtpHint}</strong> (auto-filled below)
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  6-Digit Verification OTP (Sent to Email / WhatsApp / DLT SMS)
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter 6-digit OTP (e.g. 482910)"
                  className="w-full px-3.5 py-2.5 rounded-xl font-mono text-base tracking-widest bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                />
              </div>

              {otpMode === 'PASSWORD_RESET' && (
                <div>
                  <label className="block font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    New Password (Min 8 chars, 1 Uppercase, 1 Number)
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new strong password"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={
                  otpCode.length !== 6 ||
                  resetPasswordOtpMutation.isPending ||
                  loginWithOtpMutation.isPending
                }
                className="w-full py-2.5 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-95 transition cursor-pointer disabled:opacity-50"
              >
                {otpMode === 'OTP_LOGIN'
                  ? loginWithOtpMutation.isPending
                    ? 'Verifying OTP & Signing In...'
                    : `Verify OTP & Sign In to ${meta.role} Panel →`
                  : resetPasswordOtpMutation.isPending
                  ? 'Resetting Password & Revoking Old Sessions...'
                  : 'Verify OTP & Reset Password'}
              </button>
            </form>
          )}

          {authTab === 'REGISTER' && rolePanel === 'STUDENT' && (
            <form
              onSubmit={signupForm.handleSubmit(onSubmitSignup)}
              className="space-y-3.5"
              noValidate
            >
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Student Full Name (Legal Name for Certificates)
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    {...signupForm.register('fullName')}
                    placeholder="e.g. Ananya Chatterjee"
                    className="w-full pl-10 pr-4 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Note: Once registered, your legal name can only be modified by an Administrator.
                </p>
                {signupForm.formState.errors.fullName && (
                  <p className="text-[11px] text-rose-500 mt-0.5">
                    {signupForm.formState.errors.fullName.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    {...signupForm.register('email')}
                    placeholder="student.name@institute.edu.in"
                    className="w-full pl-10 pr-4 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                  />
                </div>
                {signupForm.formState.errors.email && (
                  <p className="text-[11px] text-rose-500 mt-0.5">
                    {signupForm.formState.errors.email.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    WhatsApp Number
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      {...signupForm.register('phone')}
                      placeholder="+91-9876543210"
                      className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
                    Referral Code (Optional)
                  </label>
                  <div className="relative">
                    <Gift className="w-3.5 h-3.5 text-emerald-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      {...signupForm.register('referralCode')}
                      placeholder="ARGON-SARAH42"
                      className="w-full pl-9 pr-3 py-2 rounded-xl text-xs font-mono bg-slate-50 dark:bg-slate-900 border border-emerald-500/40"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Create Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="password"
                    {...signupForm.register('password')}
                    placeholder="Min 8 chars, 1 uppercase, 1 digit"
                    className="w-full pl-10 pr-4 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                  />
                </div>
                {signupForm.formState.errors.password && (
                  <p className="text-[11px] text-rose-500 mt-0.5">
                    {signupForm.formState.errors.password.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={registerMutation.isPending}
                className="w-full py-2.5 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-emerald-500 to-cyan-500 hover:opacity-95 transition flex items-center justify-center gap-2 shadow-lg cursor-pointer"
              >
                {registerMutation.isPending
                  ? 'Provisioning Student Account & Wallet...'
                  : 'Create Student Account & Start Onboarding →'}
              </button>
            </form>
          )}

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
