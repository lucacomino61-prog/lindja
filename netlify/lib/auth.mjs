// Admin sign-in: one password, kept only as a scrypt hash in ADMIN_PASSWORD_HASH (make one with
// `npm run admin:password`), and a session cookie signed with SESSION_SECRET. The cookie is HttpOnly, Secure,
// SameSite=Strict and only sent to /api/admin, and lasts 12 hours.
import { scryptSync, timingSafeEqual, createHmac, randomBytes, createHash } from 'node:crypto';

const COOKIE = 'lindja_admin';
const TTL_S = 12 * 3600;
const env = (k) => globalThis.Netlify?.env.get(k) ?? process.env[k];

export const configured = () => !!(env('ADMIN_PASSWORD_HASH') && (env('SESSION_SECRET') || '').length >= 32);

// format: scrypt$N$r$p$salt(base64)$hash(base64)
export function hashPassword(password, salt = randomBytes(16)) {
  const N = 16384, r = 8, p = 1;
  const hash = scryptSync(password, salt, 32, { N, r, p });
  return `scrypt$${N}$${r}$${p}$${salt.toString('base64')}$${hash.toString('base64')}`;
}
export function checkPassword(password) {
  const stored = env('ADMIN_PASSWORD_HASH') || '';
  const [kind, N, r, p, salt, hash] = stored.split('$');
  if (kind !== 'scrypt' || !hash || typeof password !== 'string' || password.length > 200) return false;
  const want = Buffer.from(hash, 'base64');
  const got = scryptSync(password, Buffer.from(salt, 'base64'), want.length, { N: +N, r: +r, p: +p });
  return timingSafeEqual(got, want);
}

const sign = (payload) => createHmac('sha256', env('SESSION_SECRET')).update(payload).digest('base64url');
export function sessionCookie() {
  const payload = `${Math.floor(Date.now() / 1000) + TTL_S}.${randomBytes(12).toString('base64url')}`;
  return `${COOKIE}=${payload}.${sign(payload)}; Path=/api/admin; Max-Age=${TTL_S}; HttpOnly; Secure; SameSite=Strict`;
}
export const clearCookie = () => `${COOKIE}=; Path=/api/admin; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
export function signedIn(req) {
  if (!configured()) return false;
  const raw = (req.headers.get('cookie') || '').split(/;\s*/).find((c) => c.startsWith(`${COOKIE}=`));
  if (!raw) return false;
  const [exp, nonce, sig] = raw.slice(COOKIE.length + 1).split('.');
  if (!exp || !nonce || !sig) return false;
  const want = Buffer.from(sign(`${exp}.${nonce}`)), got = Buffer.from(sig);
  return got.length === want.length && timingSafeEqual(got, want) && +exp > Date.now() / 1000;
}

// who is asking, without keeping their address: a salted hash of the IP
export const visitor = (context) => createHash('sha256').update(`${env('SESSION_SECRET') || 'lindja'}|${context?.ip || 'unknown'}`).digest('hex').slice(0, 16);
