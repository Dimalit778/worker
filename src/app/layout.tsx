import type { Metadata } from 'next';
import './globals.css';
import { Heebo } from 'next/font/google';
import { cn } from '@/lib/utils';
import { QueryProvider } from '@/providers/query-provider';

const heebo = Heebo({ subsets: ['hebrew', 'latin'], variable: '--font-hebrew', display: 'swap' });

export const metadata: Metadata = {
  title: 'שמירה בתי משפט',
  description: 'מערכת ניהול סידור עבודה לשוטרי בתי משפט',
  appleWebApp: {
    capable: true,
    title: 'שמירה בתי משפט',
    statusBarStyle: 'default',
  },
  // Next.js 16 emits mobile-web-app-capable; retain Apple's tag for iOS.
  other: { 'apple-mobile-web-app-capable': 'yes' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={cn('dark font-sans', heebo.variable)}>
      <body className="min-h-screen bg-background font-sans antialiased">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
