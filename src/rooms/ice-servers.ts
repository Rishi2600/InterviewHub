import { createHmac } from 'node:crypto';

export interface IceServer {
  urls: string[];
  username?: string;
  credential?: string;
}

export interface IceConfig {
  stunUrls: string[];
  turnUrls: string[];
  turnSecret: string;
  ttlSeconds: number;
}

const list = (value: string | undefined) =>
  (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

export function iceConfigFrom(env: {
  get: (key: string) => unknown;
}): IceConfig {
  return {
    stunUrls: list(env.get('STUN_URLS') as string | undefined),
    turnUrls: list(env.get('TURN_URLS') as string | undefined),
    turnSecret: (env.get('TURN_SECRET') as string | undefined) ?? '',
    ttlSeconds: Number(env.get('TURN_TTL_SECONDS') ?? 3_600),
  };
}

/**
 * The servers a browser may use to connect a call. TURN credentials follow
 * coturn's "use-auth-secret" scheme: the username is the expiry time and the
 * user id, the password an HMAC of it with a secret only coturn and the API
 * know. They stop working at the expiry, so a leaked one is short-lived, and
 * nothing has to be stored.
 */
export function iceServers(
  config: IceConfig,
  userId: string,
  now: Date,
): { iceServers: IceServer[]; ttlSeconds: number } {
  const servers: IceServer[] = [];
  if (config.stunUrls.length) servers.push({ urls: config.stunUrls });
  if (config.turnUrls.length && config.turnSecret) {
    const expiry = Math.floor(now.getTime() / 1_000) + config.ttlSeconds;
    const username = `${expiry}:${userId}`;
    const credential = createHmac('sha1', config.turnSecret)
      .update(username)
      .digest('base64');
    servers.push({ urls: config.turnUrls, username, credential });
  }
  return { iceServers: servers, ttlSeconds: config.ttlSeconds };
}
