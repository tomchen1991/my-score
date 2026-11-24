import { DurableObject } from 'cloudflare:workers';
import { AuthProviderError, isActive, isOwner, revokeToken, rotateToken, sessionKey } from './auth-provider';
import type { AuthBindings } from './auth-provider';

export const SESSION_TTL = 24 * 60 * 60;
const RECORD = 'session';

type Session = { expiresAt: number; iv: Uint8Array<ArrayBuffer>; ciphertext: ArrayBuffer; rotating?: true };
type CheckResult = 'valid' | 'renewed' | 'expired' | 'unavailable';

export class ScoreAuthSession extends DurableObject<AuthBindings> {
  private tail: Promise<unknown> = Promise.resolve();

  // Requests to an object can interleave across fetch(). Queue all operations for
  // this session so no two requests use the same rotating refresh token.
  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.tail.then(operation);
    this.tail = result.catch(() => {});
    return result;
  }

  private async save(refreshToken: string, activityAt: number) {
    const expiresAt = activityAt + SESSION_TTL * 1000;
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv }, await sessionKey(this.env), new TextEncoder().encode(refreshToken),
    );
    await this.ctx.storage.setAlarm(expiresAt);
    await this.ctx.storage.put(RECORD, { expiresAt, iv, ciphertext } satisfies Session);
  }

  private async readToken(session: Session) {
    const bytes = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: session.iv }, await sessionKey(this.env), session.ciphertext,
    );
    return new TextDecoder().decode(bytes);
  }

  private async clear() {
    await this.ctx.storage.delete(RECORD);
    await this.ctx.storage.deleteAlarm();
  }

  start(refreshToken: string, activityAt: number) {
    return this.serialize(() => this.save(refreshToken, activityAt));
  }

  check(activity: boolean): Promise<CheckResult> {
    return this.serialize(async () => {
      const session = await this.ctx.storage.get<Session>(RECORD);
      if (!session) return 'expired';
      if (session.rotating || session.expiresAt <= Date.now()) {
        // A previous refresh may have completed upstream just before a restart.
        // Never reuse the old token in that case.
        await this.clear();
        return 'expired';
      }

      const refreshToken = await this.readToken(session);
      if (!activity) {
        try {
          if (await isActive(this.env, refreshToken) && session.expiresAt > Date.now()) return 'valid';
        } catch {
          return 'unavailable';
        }
        await this.clear();
        return 'expired';
      }

      const activityAt = Date.now();
      await this.ctx.storage.put(RECORD, { ...session, rotating: true } satisfies Session);
      // Ensure the rotation marker is durable even if this Worker dies mid-fetch.
      await this.ctx.storage.sync();
      let currentToken = refreshToken;
      try {
        const rotated = await rotateToken(this.env, refreshToken);
        currentToken = rotated.refreshToken;
        if (currentToken === refreshToken || !await isOwner(this.env, rotated.accessToken)) {
          throw new Error('Invalid token rotation or identity');
        }
        await this.save(currentToken, activityAt);
        return 'renewed';
      } catch (error) {
        await this.clear();
        // Don't retry a refresh with an uncertain result. Revoke the last known token when possible.
        if (!(error instanceof AuthProviderError && error.code === 'invalid_grant')) {
          await revokeToken(this.env, currentToken).catch(() => {});
        }
        return 'expired';
      }
    });
  }

  logout(): Promise<boolean> {
    return this.serialize(async () => {
      const session = await this.ctx.storage.get<Session>(RECORD);
      await this.clear();
      if (!session) return true;
      try {
        await revokeToken(this.env, await this.readToken(session));
        return true;
      } catch {
        return false;
      }
    });
  }

  override alarm() {
    return this.serialize(async () => {
      const session = await this.ctx.storage.get<Session>(RECORD);
      if (session && session.expiresAt > Date.now()) {
        await this.ctx.storage.setAlarm(session.expiresAt);
      } else {
        await this.clear();
      }
    });
  }
}
