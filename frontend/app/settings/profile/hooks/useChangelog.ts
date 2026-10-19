'use client';

import { useEffect, useState } from 'react';
import type { ChangelogEntry } from '@/app/components/ChangelogModal';
import type { ChangelogPayload } from '@/app/settings/profile/profileHelpers';

export type UseChangelogReturn = {
  changelogEntries: ChangelogEntry[];
  changelogLoading: boolean;
  changelogSelectedEntry: ChangelogEntry | null;
  setChangelogSelectedEntry: (entry: ChangelogEntry | null) => void;
};

export function useChangelog(
  isAuthenticated: boolean,
  workspaceReady: boolean,
): UseChangelogReturn {
  const [changelogEntries, setChangelogEntries] = useState<ChangelogEntry[]>([]);
  const [changelogLoading, setChangelogLoading] = useState(false);
  const [changelogSelectedEntry, setChangelogSelectedEntry] = useState<ChangelogEntry | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!workspaceReady) return;

    let cancelled = false;

    const loadChangelog = async () => {
      await (async () => {
        setChangelogLoading(true);
        const response = await fetch('/changelog.json', { cache: 'no-store' });

        if (!response.ok) {
          throw new Error(`Failed to load changelog: ${response.status}`);
        }

        const payload = (await response.json()) as ChangelogPayload;
        if (!cancelled) {
          setChangelogEntries(Array.isArray(payload.entries) ? payload.entries : []);
        }
      })()
        .catch(async () => {
          if (!cancelled) {
            setChangelogEntries([]);
          }
        })
        .finally(async () => {
          if (!cancelled) {
            setChangelogLoading(false);
          }
        });
    };

    void loadChangelog();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, workspaceReady]);

  return {
    changelogEntries,
    changelogLoading,
    changelogSelectedEntry,
    setChangelogSelectedEntry,
  };
}
