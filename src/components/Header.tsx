import Link from 'next/link';

// Drop NatWest's official logo in public/natwest-logo.svg and swap the
// wordmark below for <img src="/natwest-logo.svg" alt="NatWest" />.
export function Header() {
  return (
    <header className="bg-nw-deep text-white">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-3" aria-label="Stagger by NatWest, home">
          <span className="text-xl font-bold tracking-tight">NatWest</span>
          <span className="h-5 w-px bg-white/40" aria-hidden />
          <span className="font-medium text-white/90">Stagger</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/start" className="hover:underline">
            Get started
          </Link>
          <Link href="/forecast/dev" className="hidden hover:underline sm:inline">
            Demo
          </Link>
        </nav>
      </div>
    </header>
  );
}
