import Link from 'next/link';
import { Container } from '@/components/ui';

// Sits top-left over each page's purple hero.
// Drop NatWest's official logo in public/natwest-logo.svg and swap the
// wordmark below for <img src="/natwest-logo.svg" alt="NatWest" />.
export function Logo() {
  return (
    <div className="absolute inset-x-0 top-0 z-10 text-white">
      <Container className="flex h-16 items-center">
        <Link href="/" className="flex items-center gap-3" aria-label="Stagger by NatWest, home">
          <span className="text-xl font-semibold tracking-tight">NatWest</span>
          <span className="h-5 w-px bg-white/40" aria-hidden />
          <span className="text-white/90">Stagger</span>
        </Link>
      </Container>
    </div>
  );
}
