import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'שמירה בתי משפט',
  description: 'מערכת ניהול סידור עבודה לשוטרי בתי משפט',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body className="min-h-screen bg-background font-sans antialiased">{children}</body>
    </html>
  );
}
