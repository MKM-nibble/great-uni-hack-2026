import { OnboardingForm } from '@/components/OnboardingForm';

export default function Start() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Let’s build your forecast</h1>
        <p className="text-sm text-nw-muted">Three quick questions. Everything stays in this browser.</p>
      </div>
      <OnboardingForm />
    </div>
  );
}
