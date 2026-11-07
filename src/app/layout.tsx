import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Header } from '@/components/Header';
import './globals.css';

const inter = Inter({ variable: '--font-inter', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Stagger by NatWest',
  description: 'A financial time machine: see money storms coming weeks ahead, and get through them.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en-GB" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <Header />
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:py-10">{children}</main>
        <footer className="border-t border-nw-line bg-white py-5 text-center text-xs text-nw-muted">
          Stagger by NatWest · Great Uni Hack 2026 prototype · demo data only, not financial advice
        </footer>
      </body>
    </html>
  );
}
