// Make the admin password hash and session secret for .env (local) or the Netlify environment (live).
// usage: npm run admin:password -- "your password"      prints the two lines to set
//        npm run admin:password -- --dev                 writes a fresh random password into .env for netlify dev
// The password itself is never stored on the server: only its scrypt hash.
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { hashPassword } from '../netlify/lib/auth.mjs';

const arg = process.argv[2];
const secret = randomBytes(32).toString('base64url');
if (arg === '--dev') {
  const password = randomBytes(9).toString('base64url');
  const file = path.resolve(import.meta.dirname, '..', '.env');
  const keep = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split(/\r?\n/).filter((l) => l && !/^(ADMIN_PASSWORD_HASH|SESSION_SECRET|# admin password for netlify dev)/.test(l)) : [];
  fs.writeFileSync(file, [...keep, `# admin password for netlify dev (local only, never commit): ${password}`, `ADMIN_PASSWORD_HASH=${hashPassword(password)}`, `SESSION_SECRET=${secret}`, ''].join('\n'));
  console.log(`wrote ${file}: the local admin password is on the comment line in that file`);
} else if (arg && arg.length >= 10) {
  console.log(`ADMIN_PASSWORD_HASH=${hashPassword(arg)}\nSESSION_SECRET=${secret}`);
} else {
  console.error('give a password of 10 characters or more, or --dev');
  process.exit(1);
}
