export function safeInternalPath(nextPath: string | null): string | null {
  if (!nextPath) {
    return null;
  }
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(nextPath);
  } catch {
    return null;
  }
  if (decodedPath !== decodedPath.trim()) {
    return null;
  }
  if (decodedPath.includes('\\')) {
    return null;
  }
  if (!decodedPath.startsWith('/')) {
    return null;
  }
  if (decodedPath.startsWith('//')) {
    return null;
  }

  const base = 'https://seneca.local';
  const parsed = new URL(decodedPath, base);
  if (parsed.origin !== base) {
    return null;
  }
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}
