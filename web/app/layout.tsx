import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import './experience.css';

export const metadata: Metadata = {
  title: 'کاوه انتقامجو',
  description: 'پیام‌رسان، شبکه اجتماعی و فضای اشتراک‌گذاری فایل کاوه انتقامجو',
  applicationName: 'کاوه انتقامجو',
  icons: { icon: '/icon.svg', shortcut: '/icon.svg', apple: '/icon.svg' },
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#03060c',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="fa" dir="rtl"><body>{children}</body></html>;
}
