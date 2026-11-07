import Link from 'next/link';

// Two-tier header in the style of natwest.com: a dark utility strip on top,
// then the brand bar with the logo.
// Drop NatWest's official logo in public/natwest-logo.svg and swap the
// wordmark below for <img src="/natwest-logo.svg" alt="NatWest" />.
export function Header() {
  return (
    <header className="text-white">
      <div className="bg-nw-deep">
        <div className="mx-auto flex h-10 max-w-6xl items-stretch px-4 text-sm sm:px-6">
          <span className="flex items-center bg-nw-purple px-4">Personal</span>
          <span className="flex items-center px-4 text-white/75">Stagger</span>
        </div>
      </div>
      <div className="border-b border-white/15 bg-nw-purple">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3" aria-label="Stagger by NatWest, home">
            <span
              aria-hidden
              className="flex h-9 w-9 items-center justify-center rounded-md bg-nw-deep font-display text-lg font-extrabold"
            >
              S
            </span>
            <span className="text-xl font-semibold tracking-tight">NatWest</span>
            <span className="h-5 w-px bg-white/40" aria-hidden />
            <span className="text-white/90">Stagger</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
