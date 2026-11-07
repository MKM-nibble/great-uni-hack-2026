import { OnboardingForm } from '@/components/OnboardingForm';
import { Container, PageHero } from '@/components/ui';

export default function Start() {
  return (
    <>
      <PageHero
        eyebrow="Stagger"
        title="Let’s build your forecast"
        lead="Three quick questions. Everything stays in this browser."
      />
      <Container className="py-10 sm:py-14">
        <div className="max-w-2xl">
          <OnboardingForm />
        </div>
      </Container>
    </>
  );
}
