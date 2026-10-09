'use client';

import { Box, Typography } from '@mui/material';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Check } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';

/** Shown at once; the list rotates through groups of this size. */
export const FEATURES_PER_GROUP = 3;
const ROTATE_MS = 4000;

const FEATURE_KEYS = [
  'statements',
  'receipts',
  'categories',
  'budgets',
  'forecast',
  'subscriptions',
  'currencies',
  'workspaces',
  'reports',
] as const;

type AuthHeroProps = {
  title: ReactNode;
  tagline: ReactNode;
};

function FeatureItem({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <Box component="li" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontSize: 15 }}>
      <Box
        component="span"
        aria-hidden
        className="lumio-auth-hero__check"
        sx={{
          width: 24,
          height: 24,
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
        }}
      >
        <Check size={14} />
      </Box>
      <span>{children}</span>
    </Box>
  );
}

/**
 * The quiet right half of the auth pages: a large wordmark, one line of
 * tagline and the product's promises, three at a time, rotating. Colours
 * follow the theme through `.lumio-auth-hero` in _auth.scss. Rotation
 * pauses while the pointer or focus is on the list and stays off for people
 * who asked the system for reduced motion. The grid-and-glow backdrop comes
 * from the (auth) layout.
 */
export function AuthHero({ title, tagline }: AuthHeroProps): React.JSX.Element {
  const { features } = useIntlayer('authHero');
  const reducedMotion = useReducedMotion();
  const [group, setGroup] = useState(0);
  const [paused, setPaused] = useState(false);
  const groupCount = Math.ceil(FEATURE_KEYS.length / FEATURES_PER_GROUP);

  useEffect(() => {
    if (reducedMotion || paused) {
      return;
    }
    const timer = window.setInterval(() => setGroup(prev => (prev + 1) % groupCount), ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [reducedMotion, paused, groupCount]);

  const visible = FEATURE_KEYS.slice(group * FEATURES_PER_GROUP, (group + 1) * FEATURES_PER_GROUP);

  return (
    <Box className="lumio-auth-hero" sx={{ textAlign: 'left', maxWidth: 440, mx: 'auto' }}>
      <Typography
        component="p"
        sx={{
          fontFamily: 'var(--font-nunito), "Nunito", sans-serif',
          fontSize: { md: 48, lg: 56 },
          fontWeight: 800,
          letterSpacing: '-0.02em',
          lineHeight: 1.05,
        }}
      >
        {title}
      </Typography>
      <Typography
        className="lumio-auth-hero__tagline"
        sx={{ mt: 2, fontSize: 18, lineHeight: 1.6 }}
      >
        {tagline}
      </Typography>
      {/* A fixed height for three rows, so the page never shifts as groups swap. */}
      <Box
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
        sx={{ mt: 4, minHeight: FEATURES_PER_GROUP * 38 }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.ul
            key={group}
            initial={reducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.35 }}
            style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 14 }}
          >
            {visible.map(key => (
              <FeatureItem key={key}>{features[key]}</FeatureItem>
            ))}
          </motion.ul>
        </AnimatePresence>
      </Box>
    </Box>
  );
}
