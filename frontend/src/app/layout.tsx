import type { Metadata } from 'next';
import './globals.css';
import { AppProviders } from '@/providers/AppProviders';

export const metadata: Metadata = {
  title: 'Gemini Argon — Online Learning Platform',
  description:
    'Role-based Online Learning Platform with Admin, Student, Teacher Cockpit, and Support Team Command Center.',
};

const themeInitScript = `
(function() {
  try {
    var saved = window.localStorage.getItem('argon_lms_theme');
    var mode = (saved === 'light' || saved === 'dark') ? saved : 'dark';
    var root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(mode);
    root.setAttribute('data-theme', mode);
    root.style.colorScheme = mode;
  } catch (e) {
    document.documentElement.classList.add('dark');
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen argon-shell-bg transition-colors duration-300">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
