/** Parses CORS_ORIGINS ("https://a.com, https://b.com") into a list. */
export function parseOrigins(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

/**
 * Browsers always send Origin, so a browser on another site is refused. Clients
 * without an Origin header (curl, server-to-server) are not browsers and cannot
 * be told apart by origin anyway, so they pass; auth still applies to them.
 */
export function isAllowedOrigin(
  origin: string | undefined,
  allowed: string[],
): boolean {
  return origin === undefined || allowed.includes(origin);
}
