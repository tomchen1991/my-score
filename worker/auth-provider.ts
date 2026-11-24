const PRODUCTION_ISSUER = 'https://auth.falsita.cn';
const TOTP_GRANT = 'urn:falsita:params:oauth:grant-type:totp';
export const OWNER = 'owner';

export type AuthBindings = Env & { AUTH_ISSUER?: string };

export class AuthProviderError extends Error {
  constructor(readonly status: number, readonly code?: string) {
    super('Auth provider rejected the request');
  }
}

function isLoopbackUrl(url: URL) {
  return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
}

export function appOrigin(env: AuthBindings): string {
  const url = new URL(env.AUTH_APP_ORIGIN);
  if (url.origin !== env.AUTH_APP_ORIGIN ||
      (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLoopbackUrl(url)))) {
    throw new Error('Invalid app origin');
  }
  return url.origin;
}

function issuer(env: AuthBindings) {
  const url = new URL(env.AUTH_ISSUER || PRODUCTION_ISSUER);
  // Pin production endpoints. Only local development may use a mock issuer.
  const app = new URL(appOrigin(env));
  if (url.href !== `${PRODUCTION_ISSUER}/` && !(isLoopbackUrl(app) && isLoopbackUrl(url) && url.href === `${url.origin}/` && ['https:', 'http:'].includes(url.protocol))) {
    throw new Error('Invalid auth issuer');
  }
  return url.origin;
}

function basicAuth(env: AuthBindings) {
  if (!env.OIDC_CLIENT_ID || !env.OIDC_CLIENT_SECRET) throw new Error('Missing client credentials');
  const encode = (value: string) => new URLSearchParams({ v: value }).toString().slice(2);
  return `Basic ${btoa(`${encode(env.OIDC_CLIENT_ID)}:${encode(env.OIDC_CLIENT_SECRET)}`)}`;
}

async function post(env: AuthBindings, path: string, body: Record<string, string>) {
  const response = await fetch(`${issuer(env)}${path}`, {
    method: 'POST',
    headers: { Authorization: basicAuth(env), Accept: 'application/json' },
    body: new URLSearchParams(body),
    redirect: 'manual',
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) {
    const error = await response.json<{ error?: string }>().catch(() => null);
    throw new AuthProviderError(response.status, error?.error);
  }
  return response;
}

async function tokens(env: AuthBindings, body: Record<string, string>) {
  const response = await post(env, '/token', body);
  const data = await response.json<{ access_token?: string; refresh_token?: string; token_type?: string }>();
  if (!data || typeof data.access_token !== 'string' || !data.access_token ||
      typeof data.refresh_token !== 'string' || !data.refresh_token ||
      typeof data.token_type !== 'string' || data.token_type.toLowerCase() !== 'bearer') {
    throw new Error('Invalid auth token response');
  }
  return { accessToken: data.access_token, refreshToken: data.refresh_token };
}

export function loginWithCode(env: AuthBindings, code: string) {
  return tokens(env, { grant_type: TOTP_GRANT, code, scope: 'openid profile' });
}

export function rotateToken(env: AuthBindings, refreshToken: string) {
  return tokens(env, { grant_type: 'refresh_token', refresh_token: refreshToken });
}

export async function isOwner(env: AuthBindings, accessToken: string) {
  const response = await fetch(`${issuer(env)}/me`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    redirect: 'manual',
    signal: AbortSignal.timeout(8_000),
  });
  if (response.status === 401 || response.status === 403) return false;
  if (!response.ok) throw new AuthProviderError(response.status);
  return (await response.json<{ sub?: string }>())?.sub === OWNER;
}

export async function isActive(env: AuthBindings, refreshToken: string) {
  const response = await post(env, '/token/introspection', { token: refreshToken, token_type_hint: 'refresh_token' });
  const data = await response.json<{ active?: boolean; client_id?: string; sub?: string }>();
  return data?.active === true && data.client_id === env.OIDC_CLIENT_ID && data.sub === OWNER;
}

export async function revokeToken(env: AuthBindings, refreshToken: string) {
  await post(env, '/token/revocation', { token: refreshToken, token_type_hint: 'refresh_token' });
}

export async function sessionKey(env: AuthBindings): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(env.AUTH_SESSION_KEY || ''), (ch) => ch.charCodeAt(0));
  if (raw.length !== 32) throw new Error('AUTH_SESSION_KEY must encode 32 random bytes');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
