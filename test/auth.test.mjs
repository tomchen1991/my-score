import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { unstable_dev } from 'wrangler';

const origin = 'http://localhost:5173';
const clientId = 'local:test+client';
const clientSecret = 'local:test+secret';
const directGrant = 'urn:falsita:params:oauth:grant-type:totp';

function mockAuth() {
  let token = null;
  let rotations = 0;
  let loseRefreshResponse = false;
  const server = createServer(async (req, res) => {
    function json(status, data) {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    }
    if (req.url === '/me') {
      return req.headers.authorization === 'Bearer local-access' && token
        ? json(200, { sub: 'owner' }) : json(401, { error: 'invalid_token' });
    }
    if (req.headers.authorization !== `Basic ${Buffer.from('local%3Atest%2Bclient:local%3Atest%2Bsecret').toString('base64')}`) {
      return json(401, { error: 'invalid_client' });
    }
    let body = '';
    for await (const chunk of req) body += chunk;
    const params = new URLSearchParams(body);
    if (req.url === '/token') {
      if (params.get('grant_type') === directGrant) {
        if (params.get('code') !== '123456') return json(400, { error: 'invalid_grant' });
      } else {
        rotations++;
        if (params.get('grant_type') !== 'refresh_token' || !token || params.get('refresh_token') !== token) {
          token = null;
          return json(400, { error: 'invalid_grant' });
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      token = randomBytes(16).toString('hex');
      if (loseRefreshResponse && params.get('grant_type') === 'refresh_token') return req.socket.destroy();
      return json(200, { access_token: 'local-access', refresh_token: token, token_type: 'Bearer' });
    }
    if (req.url === '/token/introspection') {
      return json(200, params.get('token') === token && token
        ? { active: true, client_id: clientId, sub: 'owner' } : { active: false });
    }
    if (req.url === '/token/revocation') {
      if (params.get('token') === token) token = null;
      return json(200, {});
    }
    return json(404, {});
  });
  return {
    server,
    rotations: () => rotations,
    current: () => token,
    revoke: () => { token = null; },
    loseRefresh: () => { loseRefreshResponse = true; },
  };
}

test('Auth Worker: login, activity-only rotation, revocation and logout', { timeout: 40_000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'my-score-auth-'));
  const mock = mockAuth();
  let worker;
  try {
    await new Promise((resolve) => mock.server.listen(0, '127.0.0.1', resolve));
    execFileSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'd1', 'migrations', 'apply', 'my-score', '--local', '--persist-to', directory], { stdio: ['ignore', 'pipe', 'pipe'] });
    worker = await unstable_dev('worker/index.ts', {
      local: true,
      compatibilityDate: '2026-06-10', // Newest date supported by the pinned local workerd binary.
      port: 0,
      persist: true,
      persistTo: directory,
      vars: {
        AUTH_APP_ORIGIN: origin,
        AUTH_ISSUER: `http://127.0.0.1:${mock.server.address().port}`,
        OIDC_CLIENT_ID: clientId,
        OIDC_CLIENT_SECRET: clientSecret,
        AUTH_SESSION_KEY: randomBytes(32).toString('base64'),
      },
      experimental: { disableExperimentalWarning: true, disableDevRegistry: true },
    });

    const login = (code, requestOrigin = origin) => worker.fetch('/api/auth/login', {
      method: 'POST', headers: { Origin: requestOrigin, 'Content-Type': 'application/json' }, body: JSON.stringify({ code }),
    });
    const expectStatus = async (response, status) => {
      assert.equal(response.status, status, await response.clone().text());
      return response;
    };
    const signIn = async () => {
      const response = await expectStatus(await login('123456'), 200);
      assert.deepEqual(await response.json(), { code: 0, message: '登录成功' });
      const cookie = response.headers.get('Set-Cookie');
      assert.match(cookie, /^score_session=[a-f0-9]{64};/);
      assert.match(cookie, /Max-Age=86400/);
      assert.match(cookie, /HttpOnly/);
      assert.match(cookie, /SameSite=Lax/);
      assert.ok(!cookie.includes(mock.current()));
      return cookie.split(';')[0];
    };
    const fetchPage = (cookie, activity) => worker.fetch('/api/media/page?type=game', {
      headers: { Cookie: cookie, ...(activity ? { 'X-Score-Activity': '1' } : {}) },
    });

    await expectStatus(await worker.fetch('/api/media/perfect'), 200);
    await expectStatus(await fetchPage(''), 401);
    await expectStatus(await login('123456', 'https://wrong.example'), 403);
    await expectStatus(await login('123000'), 400);
    let cookie = await signIn();

    const verify = await expectStatus(await worker.fetch('/api/auth/verify', { headers: { Cookie: cookie, 'X-Score-Activity': '1' } }), 200);
    assert.equal(verify.headers.get('Set-Cookie'), null);
    assert.equal((await expectStatus(await fetchPage(cookie), 200)).headers.get('Set-Cookie'), null);
    assert.equal(mock.rotations(), 0);
    for (const response of await Promise.all([fetchPage(cookie, true), fetchPage(cookie, true)])) {
      await expectStatus(response, 200);
      assert.match(response.headers.get('Set-Cookie'), /Max-Age=86400/);
    }
    assert.equal(mock.rotations(), 2); // Concurrent local requests did not reuse a token.

    mock.revoke();
    await expectStatus(await fetchPage(cookie), 401);
    cookie = await signIn();
    const logout = await expectStatus(await worker.fetch('/api/auth/logout', { method: 'POST', headers: { Origin: origin, Cookie: cookie } }), 200);
    assert.deepEqual(await logout.json(), { code: 0, data: { revoked: true } });
    assert.match(logout.headers.get('Set-Cookie'), /Max-Age=0/);
    assert.equal(mock.current(), null);
    await expectStatus(await fetchPage(cookie), 401);

    cookie = await signIn();
    mock.loseRefresh();
    const rotationsBefore = mock.rotations();
    await expectStatus(await fetchPage(cookie, true), 401);
    await expectStatus(await fetchPage(cookie, true), 401);
    assert.equal(mock.rotations(), rotationsBefore + 1, 'an ambiguous refresh is not retried');
  } finally {
    await worker?.stop();
    mock.server.closeAllConnections();
    await new Promise((resolve) => mock.server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
