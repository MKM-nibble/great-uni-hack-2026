'use client';

import { useRef, type ReactNode } from 'react';
import { OnboardingForm } from '@/components/OnboardingForm';

/** A button that opens the one-screen onboarding as a popup. */
export function StartDialog({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className={className} onClick={() => ref.current?.showModal()}>
        {children}
      </button>
      <dialog
        ref={ref}
        aria-labelledby="start-title"
        onClick={(e) => e.target === ref.current && ref.current.close()}
        className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-lg bg-white p-0 text-nw-text backdrop:bg-nw-deep/70"
      >
        <div className="flex items-start justify-between gap-4 bg-nw-purple px-5 py-6 text-white sm:px-8">
          <div>
            <h1 id="start-title" className="text-3xl !text-white">
              Let’s build your forecast
            </h1>
            <p className="mt-1 text-white/85">Three quick questions. Everything stays in this browser.</p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={() => ref.current?.close()}
            className="rounded-full px-2 py-1 text-xl text-white/80 hover:bg-white/15 hover:text-white"
          >
            ✕
          </button>
        </div>
        <div className="p-5 sm:p-8">
          <OnboardingForm />
        </div>
      </dialog>
    </>
  );
}
