import type { Context, Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { appOrigin, AuthProviderError, isOwner, loginWithCode, OWNER, revokeToken, sessionKey } from './auth-provider';
import type { AuthBindings } from './auth-provider';
import { SESSION_TTL } from './auth-session';

type AuthContext = Context<{ Bindings: AuthBindings }>;

function sessionCookie(origin: string) {
  const secure = origin.startsWith('https://');
  return {
    name: secure ? '__Host-score_session' : 'score_session',
    options: { path: '/', httpOnly: true, sameSite: 'Lax', secure } as const,
  };
}

function newSessionId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function getSessionId(c: AuthContext, cookieName: string) {
  const id = getCookie(c, cookieName);
  return id && /^[a-f0-9]{64}$/.test(id) ? id : undefined;
}

function sessionObject(env: AuthBindings, id: string) {
  return env.AUTH_SESSIONS.get(env.AUTH_SESSIONS.idFromName(id));
}

export function setupAuth(app: Hono<{ Bindings: AuthBindings }>) {
  app.use('/api/*', async (c, next) => {
    if (c.req.method === 'GET' && c.req.path === '/api/media/perfect') return next();
    c.header('Cache-Control', 'no-store');
    const origin = appOrigin(c.env);
    const mutating = c.req.method !== 'GET' && c.req.method !== 'HEAD';
    if (mutating && c.req.header('Origin') !== origin) {
      return c.json({ code: 403, message: '请求来源不受信任' }, 403);
    }
    if (c.req.method === 'POST' && (c.req.path === '/api/auth/login' || c.req.path === '/api/auth/logout')) return next();

    const cookie = sessionCookie(origin);
    const id = getSessionId(c, cookie.name);
    if (!id) return c.json({ code: 401, message: '请先登录' }, 401);
    // Initial load and auth probes don't count as activity. For read-only media
    // actions, the UI sets a non-simple header (cross-origin CORS is not allowed).
    const mediaAction = c.req.path.startsWith('/api/media/') && (mutating || (
      c.req.method === 'GET' && c.req.header('X-Score-Activity') === '1'
    ));
    const result = await sessionObject(c.env, id).check(mediaAction).catch(() => 'unavailable');
    if (result === 'unavailable') return c.json({ code: 503, message: '暂时无法验证登录状态' }, 503);
    if (result === 'expired') {
      deleteCookie(c, cookie.name, cookie.options);
      return c.json({ code: 401, message: '登录已失效，请重新登录' }, 401);
    }
    if (result === 'renewed') setCookie(c, cookie.name, id, { ...cookie.options, maxAge: SESSION_TTL });
    await next();
  });

  app.post('/api/auth/login', async (c) => {
    const limit = await c.env.AUTH_LOGIN_LIMIT.limit({ key: c.req.header('CF-Connecting-IP') || 'local' });
    if (!limit.success) {
      c.header('Retry-After', '60');
      return c.json({ code: 429, message: '尝试次数过多，请稍后重试' }, 429);
    }
    if (c.req.header('Content-Type')?.split(';')[0] !== 'application/json') {
      return c.json({ code: 415, message: '需要 JSON 请求' }, 415);
    }
    const body = await c.req.json<{ code?: unknown }>().catch(() => null);
    const code = typeof body?.code === 'string' ? body.code.trim() : '';
    if (!/^(?:[0-9]{6}|[0-9a-f]{32})$/.test(code)) {
      return c.json({ code: 400, message: '请输入 6 位验证码或 32 位恢复码' }, 400);
    }

    let issuedToken: string | undefined;
    try {
      await sessionKey(c.env); // Check configuration before consuming the one-time code.
      const activityAt = Date.now();
      const tokens = await loginWithCode(c.env, code);
      issuedToken = tokens.refreshToken;
      if (!await isOwner(c.env, tokens.accessToken)) throw new Error('Unrecognized auth subject');
      const cookie = sessionCookie(appOrigin(c.env));
      const previousId = getSessionId(c, cookie.name);
      if (previousId) await sessionObject(c.env, previousId).logout().catch(() => false);
      const id = newSessionId();
      await sessionObject(c.env, id).start(issuedToken, activityAt);
      setCookie(c, cookie.name, id, { ...cookie.options, maxAge: SESSION_TTL });
      return c.json({ code: 0, message: '登录成功' });
    } catch (error) {
      if (issuedToken) await revokeToken(c.env, issuedToken).catch(() => {});
      if (error instanceof AuthProviderError && error.code === 'invalid_grant') {
        return c.json({ code: 400, message: '验证码无效或已使用，请检查或等待下一枚验证码' }, 400);
      }
      if (error instanceof AuthProviderError && error.status === 429) {
        c.header('Retry-After', '300');
        return c.json({ code: 429, message: '尝试次数过多，请稍后重试' }, 429);
      }
      return c.json({ code: 503, message: 'Auth 登录暂不可用，请稍后重试' }, 503);
    }
  });

  app.get('/api/auth/verify', (c) => c.json({ code: 0, data: { username: OWNER } }));

  app.post('/api/auth/logout', async (c) => {
    const cookie = sessionCookie(appOrigin(c.env));
    const id = getSessionId(c, cookie.name);
    // If local storage could not be cleared, fail and let the caller retry.
    const revoked = id ? await sessionObject(c.env, id).logout() : true;
    deleteCookie(c, cookie.name, cookie.options);
    return c.json({ code: 0, data: { revoked } });
  });
}
