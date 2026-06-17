import path from 'node:path';

const MAX_PATH_LENGTH = 240;

export function normalizeAssetPath(input: string): string {
  const trimmed = input.trim().replaceAll('\\', '/').replace(/^\/+/, '');
  const normalized = path.posix.normalize(trimmed);

  if (
    !normalized ||
    normalized === '.' ||
    normalized.startsWith('../') ||
    normalized.includes('/../') ||
    normalized.length > MAX_PATH_LENGTH
  ) {
    throw new Error(`Invalid asset path: ${input}`);
  }

  return normalized;
}

export function isHtmlPath(assetPath: string): boolean {
  return assetPath.toLowerCase().endsWith('.html') || assetPath.toLowerCase().endsWith('.htm');
}
