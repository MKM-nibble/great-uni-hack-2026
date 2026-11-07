import type { Metadata } from 'next';
import { Bitter, Inter } from 'next/font/google';
import { Logo } from '@/components/Logo';
import './globals.css';

const inter = Inter({ variable: '--font-inter', subsets: ['latin'] });
// Free stand-in for NatWest's slab-serif heading face.
const bitter = Bitter({ variable: '--font-bitter', subsets: ['latin'], weight: ['700', '800'] });

export const metadata: Metadata = {
  title: 'Stagger by NatWest',
  description: 'See when money gets tight, before it does.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en-GB" className={`${inter.variable} ${bitter.variable} h-full antialiased`}>
      <body className="relative flex min-h-full flex-col font-sans">
        <Logo />
        {/* Full width: each page lays out its own purple hero band and content column. */}
        <main className="flex-1 pb-16">{children}</main>
      </body>
    </html>
  );
}
