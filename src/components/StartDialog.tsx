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
        className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl bg-nw-mist p-0 text-nw-ink backdrop:bg-nw-deep/60"
      >
        <div className="p-5 sm:p-7">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h1 id="start-title" className="text-2xl font-bold">
                Let’s build your forecast
              </h1>
              <p className="text-sm text-nw-muted">Three quick questions. Everything stays in this browser.</p>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={() => ref.current?.close()}
              className="rounded-full px-2 py-1 text-xl text-nw-muted hover:bg-nw-lilac"
            >
              ✕
            </button>
          </div>
          <OnboardingForm />
        </div>
      </dialog>
    </>
  );
}
