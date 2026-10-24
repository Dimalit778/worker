import type { Metadata } from 'next';
import './globals.css';
import { Heebo } from 'next/font/google';
import { cn } from '@/lib/utils';
import { QueryProvider } from '@/providers/query-provider';

const heebo = Heebo({ subsets: ['hebrew', 'latin'], variable: '--font-hebrew', display: 'swap' });

export const metadata: Metadata = {
  title: 'שמירה בתי משפט',
  description: 'מערכת ניהול סידור עבודה לשוטרי בתי משפט',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={cn('dark font-sans', heebo.variable)}>
      <body className="min-h-dvh bg-background font-sans antialiased max-md:scrollbar-hide">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
