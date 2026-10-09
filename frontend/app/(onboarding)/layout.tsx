import type { ReactNode } from 'react';

/** The same grid-and-glow backdrop as the sign-in pages: onboarding is their continuation. */
export default function OnboardingRootLayout({ children }: { children: ReactNode }) {
  return <div className="lumio-auth-backdrop">{children}</div>;
}
