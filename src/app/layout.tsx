import type { Metadata } from 'next';
import './globals.css';
import { Montserrat } from 'next/font/google';
import { cn } from '@/lib/utils';
import { QueryProvider } from '@/providers/query-provider';

const montserrat = Montserrat({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'שמירה בתי משפט',
  description: 'מערכת ניהול סידור עבודה לשוטרי בתי משפט',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={cn('font-sans', montserrat.variable)}>
      <body className="min-h-screen bg-background font-sans antialiased">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
