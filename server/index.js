const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { sendOtpEmail, sendBugReportEmail } = require('./mailer');
const { expiryOf, isExpired } = require('./subscription');
const { configurePush, registerPushToken, removePushToken } = require('./push');

const { openStore } = require('./store');

const port = Number(process.env.API_PORT || 4000);
// Filled in by main() once the store (MongoDB, or the JSON file fallback) has loaded.
let data;
let save = () => {};
let files;
function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Platform-Key', 'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS' });
  res.end(JSON.stringify(body));
}
function normalizeEmail(value) { return String(value || '').trim().toLowerCase(); }
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
}
function verifyPassword(password, stored) {
  if (!stored) return false;
  const [salt, digest] = stored.split(':');
  const actual = Buffer.from(digest, 'hex');
  const candidate = crypto.scryptSync(password, salt, actual.length);
  return crypto.timingSafeEqual(actual, candidate);
}
function publicUser(user) {
  const subscription = user.role === 'institution' ? { plan: user.plan || null, expiresAt: expiryOf(user), expired: isExpired(user) } : {};
  return { id: user.id, role: user.role, name: user.name, email: user.email, status: user.status, institutionName: user.institutionName, hasLogo: Boolean(user.attachments?.logo), ...subscription };
}
async function readJson(req, limit = 100_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error('Request is too large.');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

async function main() {
const store = await openStore();
({ data, save, files } = store);
configurePush(data, save);
console.log(`Storage: ${store.backend === 'mongodb' ? 'MongoDB' : 'local JSON file'}, files: ${store.filesBackend === 'cloudinary' ? 'Cloudinary' : store.backend === 'mongodb' ? 'MongoDB (GridFS)' : 'local folder'}`);
const handleStudent = require('./student').createHandler({ data, save, send, readJson, hashPassword, publicUser, files, isProduction: process.env.NODE_ENV === 'production' });
const handleInstitution = require('./institution').createHandler({ data, save, send, readJson, files });
const handlePayments = require('./payments').createHandler({ data, save, send, readJson, publicUser });
const handleStaff = require('./staff').createHandler({ data, save, send, readJson, hashPassword, publicUser, files, studentCore: handleStudent.core, manageStudents: handleInstitution });

require('./reminders').start({ data, save });
const bugReportTimes = new Map();

for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { store.close().finally(() => process.exit(0)); });

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  const route = new URL(req.url, 'http://localhost').pathname;
  if (route === '/api/health' && req.method === 'GET') return send(res, 200, { ok: true });
  try {
    if (route === '/api/push-tokens' && ['POST', 'DELETE'].includes(req.method)) {
      const token = String(req.headers.authorization || '').replace(/^Bearer /, '');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const session = data.sessions.find((item) => item.tokenHash === tokenHash && item.expiresAt > Date.now());
      const user = session && data.users.find((item) => item.id === session.userId);
      if (!user || !['student', 'staff', 'institution'].includes(user.role)) return send(res, 401, { error: 'Sign in to enable notifications.' });
      const input = await readJson(req);
      const pushToken = String(input.pushToken || '');
      if (!/^(Expo|Exponent)PushToken\[[\w-]+\]$/.test(pushToken)) return send(res, 400, { error: 'Invalid device notification token.' });
      const ownerId = user.role === 'student' ? user.studentId : user.role === 'staff' ? user.staffId : user.id;
      if (!ownerId) return send(res, 400, { error: 'Account is missing its notification owner.' });
      if (req.method === 'POST') registerPushToken(user.role, ownerId, pushToken, String(input.platform || '').slice(0, 20));
      else removePushToken(user.role, ownerId, pushToken);
      return send(res, 200, { ok: true });
    }
    if (route === '/api/bug-reports' && req.method === 'POST') {
      const address = String(req.socket.remoteAddress || 'unknown');
      const current = Date.now();
      const recent = (bugReportTimes.get(address) || []).filter((time) => current - time < 60 * 60 * 1000);
      if (recent.length >= 5) return send(res, 429, { error: 'Too many reports. Please try again later.' });
      const input = await readJson(req, 5_000);
      const description = String(input.description || '').trim();
      if (description.length < 10 || description.length > 2000) return send(res, 400, { error: 'Describe the issue in 10 to 2,000 characters.' });
      const token = String(req.headers.authorization || '').replace(/^Bearer /, '');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const session = data.sessions.find((item) => item.tokenHash === tokenHash && item.expiresAt > current);
      const account = session && data.users.find((item) => item.id === session.userId);
      const report = { id: crypto.randomUUID(), createdAt: new Date(current).toISOString(), description, screen: String(input.screen || 'unknown').slice(0, 100), role: account?.role || 'guest', platform: String(input.platform || 'unknown').slice(0, 30), accountEmail: account?.email || null };
      data.bugReports ||= [];
      data.bugReports.push(report);
      save();
      bugReportTimes.set(address, [...recent, current]);
      sendBugReportEmail(report).then(() => { report.emailedAt = new Date().toISOString(); save(); }).catch((error) => console.error(`Bug report ${report.id} email failed: ${error.message}`));
      return send(res, 201, { id: report.id, message: 'Bug report received.' });
    }
    // Development only: stands in for the platform's verification step so a new institution account can be tested.
    if (route === '/api/dev/verify-institution' && req.method === 'POST' && process.env.NODE_ENV !== 'production') {
      const input = await readJson(req);
      const account = data.users.find((item) => item.role === 'institution' && item.email === normalizeEmail(input.email));
      if (!account) return send(res, 404, { error: 'No institution account with that email.' });
      account.status = 'verified';
      save();
      return send(res, 200, { ok: true, institutionName: account.institutionName, status: account.status });
    }
    if (await handleStudent(req, res, route)) return;
    if (await handleStaff(req, res, route)) return;
    if (await handlePayments(req, res, route)) return;
    if (await handleInstitution(req, res, route)) return;
    if (route.startsWith('/api/platform/institutions/') && route.endsWith('/verify') && req.method === 'POST') {
      if (!process.env.PLATFORM_ADMIN_KEY || req.headers['x-platform-key'] !== process.env.PLATFORM_ADMIN_KEY) return send(res, 403, { error: 'Platform authorization required.' });
      const id = route.split('/')[4];
      const user = data.users.find((item) => item.id === id && item.role === 'institution');
      if (!user) return send(res, 404, { error: 'Institution not found.' });
      user.status = 'verified'; user.verifiedAt = new Date().toISOString(); save();
      return send(res, 200, { user: publicUser(user) });
    }
    // Step before registering: email a 6-digit code to the administrator's work email to prove it is theirs.
    if (route === '/api/auth/institutions/otp' && req.method === 'POST') {
      const input = await readJson(req);
      const email = normalizeEmail(input.email);
      if (!/^\S+@\S+\.\S+$/.test(email)) return send(res, 400, { error: 'Enter a valid work email address.' });
      if (data.users.some((user) => user.email === email)) return send(res, 409, { error: 'An account with this email already exists.' });
      data.institutionOtps ||= [];
      const code = String(crypto.randomInt(100000, 1000000));
      try { await sendOtpEmail(email, String(input.name || 'there').trim().split(' ')[0] || 'there', code, 'create your ClearanceLink institution account'); }
      catch (cause) {
        console.error('Institution OTP email failed:', cause.message);
        return send(res, 502, { error: /not configured/.test(cause.message) ? 'Email delivery is not set up yet. Please contact ClearanceLink support.' : 'We could not send the code to your email. Please try again.' });
      }
      data.institutionOtps = data.institutionOtps.filter((item) => item.email !== email && item.expiresAt > Date.now());
      data.institutionOtps.push({ email, codeHash: crypto.createHash('sha256').update(code).digest('hex'), sentAt: Date.now(), expiresAt: Date.now() + 5 * 60_000, attempts: 0 });
      save();
      return send(res, 200, { maskedContact: `${email.split('@')[0].slice(0, 3)}${'*'.repeat(4)}@${email.split('@')[1]}` });
    }
    if (route === '/api/auth/institutions/register' && req.method === 'POST') {
      const input = await readJson(req, 25_000_000);
      const email = normalizeEmail(input.email);
      const required = ['institutionName', 'institutionType', 'country', 'state', 'city', 'address', 'officialEmail', 'adminName', 'jobTitle', 'phone'];
      if (required.some((key) => !String(input[key] || '').trim()) || !/^\S+@\S+\.\S+$/.test(email) || !/^\S+@\S+\.\S+$/.test(normalizeEmail(input.officialEmail))) return send(res, 400, { error: 'Complete all required institution and administrator details.' });
      if (!/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(String(input.password || ''))) return send(res, 400, { error: 'Password needs 8 characters, an uppercase letter, a number and a symbol.' });
      if (data.users.some((user) => user.email === email)) return send(res, 409, { error: 'An account with this email already exists.' });
      data.institutionOtps ||= [];
      const otp = data.institutionOtps.find((item) => item.email === email);
      if (!otp || otp.expiresAt < Date.now()) return send(res, 400, { error: 'Your verification code has expired. Request a new one.' });
      if (otp.attempts >= 5) return send(res, 429, { error: 'Too many attempts. Request a new code.' });
      if (otp.codeHash !== crypto.createHash('sha256').update(String(input.code || '')).digest('hex')) { otp.attempts += 1; save(); return send(res, 400, { error: 'That code is incorrect.' }); }
      if (!input.logo?.base64) return send(res, 400, { error: 'Upload your institution logo.' });
      const attachments = {};
      for (const [kind, file] of Object.entries({ logo: input.logo })) {
        if (!file?.base64) continue;
        const mimeType = String(file.mimeType || '') || 'application/octet-stream';
        // The logo must be an image; verification documents can be in any format.
        const allowed = { 'image/png': '.png', 'image/jpeg': '.jpg' };
        if (kind === 'logo' && !allowed[mimeType]) return send(res, 400, { error: 'The logo must be a PNG or JPG image.' });
        const buffer = Buffer.from(file.base64, 'base64');
        const max = kind === 'logo' ? 2 : 5;
        if (!buffer.length || buffer.length > max * 1024 * 1024) return send(res, 400, { error: `${kind} must be under ${max}MB.` });
        const fileId = crypto.randomUUID();
        await files.put(fileId, buffer);
        attachments[kind] = { fileId, name: String(file.name || kind), mimeType, size: buffer.length };
      }
      const user = {
        // "unpaid" until the registration payment is confirmed; that payment is what activates the account.
        id: crypto.randomUUID(), role: 'institution', status: 'unpaid', email,
        passwordHash: hashPassword(input.password), name: String(input.adminName).trim(),
        institutionName: String(input.institutionName).trim(), institutionType: String(input.institutionType).trim(),
        country: String(input.country).trim(), state: String(input.state).trim(), city: String(input.city).trim(),
        address: String(input.address).trim(), officialEmail: normalizeEmail(input.officialEmail),
        officialPhone: String(input.officialPhone || '').trim(), website: String(input.website || '').trim(),
        jobTitle: String(input.jobTitle).trim(), phone: String(input.phone).trim(), attachments, createdAt: new Date().toISOString(),
      };
      data.users.push(user);
      data.institutionOtps = data.institutionOtps.filter((item) => item.email !== email);
      // Signed in straight away so the next registration step (payment) can act for this account.
      const token = crypto.randomBytes(32).toString('hex');
      data.sessions.push({ tokenHash: crypto.createHash('sha256').update(token).digest('hex'), userId: user.id, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 });
      save();
      return send(res, 201, { token, user: publicUser(user) });
    }
    if (route === '/api/auth/login' && req.method === 'POST') {
      const input = await readJson(req);
      const user = data.users.find((item) => item.email === normalizeEmail(input.email) && item.role === input.role);
      if (!user || !verifyPassword(String(input.password || ''), user.passwordHash)) return send(res, 401, { error: 'Email or password is incorrect.' });
      if (user.role === 'staff' && data.staff?.find((item) => item.id === user.staffId)?.disabled) return send(res, 403, { error: 'This staff account is disabled.' });
      if (user.role === 'student' && data.students?.find((item) => item.id === user.studentId)?.disabled) return send(res, 403, { error: 'This student account is disabled.' });
      const token = crypto.randomBytes(32).toString('hex');
      data.sessions.push({ tokenHash: crypto.createHash('sha256').update(token).digest('hex'), userId: user.id, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 });
      save();
      return send(res, 200, { token, user: publicUser(user) });
    }
    if (route === '/api/auth/me' && req.method === 'GET') {
      const token = String(req.headers.authorization || '').replace(/^Bearer /, '');
      const session = data.sessions.find((item) => item.tokenHash === crypto.createHash('sha256').update(token).digest('hex') && item.expiresAt > Date.now());
      const user = session && data.users.find((item) => item.id === session.userId);
      return user ? send(res, 200, { user: publicUser(user) }) : send(res, 401, { error: 'Session expired.' });
    }
    // ---- Password reset: 1) email a code, 2) verify the code, 3) set the new password ----
    // The answer never reveals whether an account exists for the email that was typed.
    if (route === '/api/auth/password/forgot' && req.method === 'POST') {
      const input = await readJson(req);
      const typed = normalizeEmail(input.email);
      if (!/^\S+@\S+\.\S+$/.test(typed)) return send(res, 400, { error: 'Enter a valid email address.' });
      const masked = `${typed.split('@')[0].slice(0, 3)}${'*'.repeat(4)}@${typed.split('@')[1]}`;
      const user = data.users.find((item) => item.email === typed && item.role === input.role);
      if (user) {
        data.resets = data.resets.filter((item) => item.expiresAt > Date.now() || item.tokenExpiresAt > Date.now());
        const existing = data.resets.find((item) => item.userId === user.id);
        // Asking again within 30 seconds just keeps the code that was already sent.
        if (existing?.sentAt && Date.now() - existing.sentAt < 30_000) return send(res, 200, { maskedContact: masked });
        const code = String(crypto.randomInt(100000, 1000000));
        try { await sendOtpEmail(user.email, user.name || '', code, 'reset your ClearanceLink password'); }
        catch (cause) {
          console.error('Password reset email failed:', cause.message);
          return send(res, 502, { error: /not configured/.test(cause.message) ? 'Email delivery is not set up yet. Please contact ClearanceLink support.' : 'We could not send the code to your email. Please try again.' });
        }
        data.resets = data.resets.filter((item) => item.userId !== user.id);
        data.resets.push({ userId: user.id, codeHash: crypto.createHash('sha256').update(code).digest('hex'), sentAt: Date.now(), expiresAt: Date.now() + 5 * 60_000, attempts: 0 });
        save();
      }
      return send(res, 200, { maskedContact: masked });
    }
    if (route === '/api/auth/password/verify' && req.method === 'POST') {
      const input = await readJson(req);
      const user = data.users.find((item) => item.email === normalizeEmail(input.email) && item.role === input.role);
      const reset = user && data.resets.find((item) => item.userId === user.id && item.expiresAt > Date.now() && item.codeHash);
      if (!reset) return send(res, 400, { error: 'That code is invalid or has expired. Request a new one.' });
      if ((reset.attempts || 0) >= 5) return send(res, 429, { error: 'Too many attempts. Request a new code.' });
      if (reset.codeHash !== crypto.createHash('sha256').update(String(input.code || '').trim()).digest('hex')) { reset.attempts = (reset.attempts || 0) + 1; save(); return send(res, 400, { error: 'That code is incorrect.' }); }
      // The code is single use; it is swapped for a short-lived token that authorises setting the new password.
      const resetToken = crypto.randomBytes(24).toString('hex');
      reset.codeHash = null;
      reset.tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
      reset.tokenExpiresAt = Date.now() + 15 * 60_000;
      save();
      return send(res, 200, { resetToken });
    }
    if (route === '/api/auth/password/reset' && req.method === 'POST') {
      const input = await readJson(req);
      const user = data.users.find((item) => item.email === normalizeEmail(input.email) && item.role === input.role);
      const tokenHash = crypto.createHash('sha256').update(String(input.resetToken || '')).digest('hex');
      const reset = user && data.resets.find((item) => item.userId === user.id && item.tokenHash === tokenHash && item.tokenExpiresAt > Date.now());
      if (!reset) return send(res, 400, { error: 'Your verification has expired. Please request a new code.' });
      if (!/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(String(input.password || ''))) return send(res, 400, { error: 'Password needs 8 characters, an uppercase letter, a number and a symbol.' });
      user.passwordHash = hashPassword(input.password);
      data.resets = data.resets.filter((item) => item.userId !== user.id);
      data.sessions = data.sessions.filter((item) => item.userId !== user.id);
      save();
      return send(res, 200, { message: 'Password updated. You can log in now.' });
    }
    return send(res, 404, { error: 'Not found.' });
  } catch (error) {
    // The app only sees a generic message for unexpected failures, so record the real reason here.
    if (!(error instanceof SyntaxError) && !/Request is too large|spreadsheet|Select a|Import at most|empty/.test(error.message)) console.error(`Request failed: ${req.method} ${route}\n`, error.stack || error);
    return send(res, error instanceof SyntaxError || /Request is too large|spreadsheet|Select a|Import at most|empty/.test(error.message) ? 400 : 500, { error: error instanceof SyntaxError ? 'Invalid JSON.' : /Request is too large|spreadsheet|Select a|Import at most|empty/.test(error.message) ? error.message : 'Request could not be completed.' });
  }
});
server.on('error', (error) => {
  if (error.code !== 'EADDRINUSE') throw error;
  console.error(`\nPort ${port} is already in use, most likely by an older copy of this API that is still running.`);
  console.error('Stop it, then run "npm run api" again. In PowerShell:');
  console.error(`  Get-NetTCPConnection -LocalPort ${port} -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }\n`);
  store.close().finally(() => process.exit(1));
});
server.listen(port, '0.0.0.0', () => console.log(`ClearanceLink API running on port ${port}`));
}

main().catch((error) => {
  if (/MongoServerSelectionError|SSL alert|ENOTFOUND|ETIMEDOUT|querySrv/i.test(`${error.name} ${error.message}`)) {
    console.error('\nClearanceLink API could not connect to MongoDB.');
    console.error('Most likely your current IP address is not on the Atlas allow-list (your IP changes when you switch Wi-Fi or network).');
    console.error('  1. In MongoDB Atlas open Security -> Network Access');
    console.error('  2. Add your current IP address (or "Add current IP address")');
    console.error('  3. Wait about a minute, then run "npm run api" again');
    console.error('To keep working offline meanwhile, comment out MONGODB_URI in .env to use the local JSON file instead.\n');
    console.error(`(${String(error.message).split('\n')[0]})`);
  } else {
    console.error('ClearanceLink API could not start:', error.stack || error.message);
  }
  process.exit(1);
});
