export function resolveDashboardDisplayDate(
  targetDate: string | null,
  effectiveEndDate?: string | null,
): string | null {
  return targetDate ?? effectiveEndDate ?? null;
}

export function resolveDashboardEffectivePeriod(
  effectiveSince?: string | null,
  effectiveEndDate?: string | null,
): string | null {
  if (!(effectiveSince && effectiveEndDate)) {
    return null;
  }

  return `${effectiveSince} - ${effectiveEndDate}`;
}
