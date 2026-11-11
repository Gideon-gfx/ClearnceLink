const crypto = require('node:crypto');

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const passwordIsStrong = (value) => /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(String(value || ''));

function createPlatformAdmin({ data, save, send, readJson, hashPassword, verifyPassword, sendOtpEmail, sendEmailChangeNotice }) {
  const adminEmail = normalizeEmail(process.env.PLATFORM_ADMIN_EMAIL);
  const sha = (value) => crypto.createHash('sha256').update(String(value || '')).digest('hex');
  const adminUser = () => ({ id: 'platform-admin', role: 'platform-admin', name: 'Platform Administrator', email: adminEmail, status: 'active' });
  const newSession = () => {
    const token = crypto.randomBytes(32).toString('hex');
    data.sessions.push({ tokenHash: sha(token), userId: 'platform-admin', role: 'platform-admin', expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 });
    save();
    return { token, user: adminUser() };
  };
  function authorized(req) {
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const session = data.sessions.find((item) => item.tokenHash === sha(token) && item.role === 'platform-admin' && item.expiresAt > Date.now());
    return session ? { id: 'platform-admin', name: 'Platform Administrator', email: adminEmail } : null;
  }
  function record(actor, action, target, detail = '') {
    data.platformAdminAudit ||= [];
    data.platformAdminAudit.unshift({ id: crypto.randomUUID(), actor: actor.email, action, target, detail: String(detail).slice(0, 500), at: new Date().toISOString() });
    data.platformAdminAudit = data.platformAdminAudit.slice(0, 2000);
  }
  const emailTaken = (email, excludeUserId, excludeEntity) =>
    data.users.some((item) => item.id !== excludeUserId && item.email === email) ||
    data.students.some((item) => !(excludeEntity?.kind === 'student' && item.id === excludeEntity.id) && item.email === email) ||
    data.staff.some((item) => !(excludeEntity?.kind === 'staff' && item.id === excludeEntity.id) && item.email === email);
  function resolveAccount(kind, id) {
    if (kind === 'institutions') return data.users.find((item) => item.id === id && item.role === 'institution') || null;
    if (kind === 'students') return data.students.find((item) => item.id === id) || null;
    if (kind === 'staff') return data.staff.find((item) => item.id === id) || null;
    return null;
  }
  function accountList(kind) {
    if (kind === 'institutions') return data.users.filter((item) => item.role === 'institution').map((item) => ({
      id: item.id, kind, name: item.name, institutionName: item.institutionName, email: item.email, phone: item.phone, officialEmail: item.officialEmail, officialPhone: item.officialPhone, address: item.address, city: item.city, state: item.state, country: item.country, status: item.status,
      plan: item.plan || null, expiresAt: item.subscriptionEndsAt || item.trialEndsAt || null,
      adminAccess: Boolean(item.adminAccess?.active), createdAt: item.createdAt,
    }));
    if (kind === 'students') return data.students.map((item) => ({
      id: item.id, kind, name: item.name, email: item.email, status: item.disabled ? 'disabled' : item.approved ? 'active' : 'pending',
      phone: item.phone, faculty: item.faculty, department: item.department, level: item.level, admissionStatus: item.admissionStatus, institutionName: item.institutionName, institutionId: item.institutionId, userId: item.userId || null,
    }));
    if (kind === 'staff') return data.staff.map((item) => ({
      id: item.id, kind, name: item.name, email: item.email, status: item.disabled ? 'disabled' : item.status,
      phone: item.phone, faculty: item.faculty, department: item.department, jobTitle: item.jobTitle, institutionName: item.institutionName, institutionId: item.institutionId, role: item.role || null, scope: item.scope || null, userId: item.userId || null,
    }));
    return [];
  }
  function setAccountEmail(kind, id, newEmail) {
    const item = resolveAccount(kind, id);
    if (!item) return false;
    const oldEmail = item.email;
    const linkedUser = kind === 'institutions'
      ? item
      : data.users.find((user) => user.id === item.userId && user.role === (kind === 'students' ? 'student' : 'staff'));
    if (linkedUser) linkedUser.email = newEmail;
    item.email = newEmail;
    if (kind === 'institutions' && item.officialEmail === oldEmail) item.officialEmail = newEmail;
    return true;
  }
  function patchAccount(kind, item, input) {
    const linkedUser = kind === 'institutions'
      ? item
      : data.users.find((user) => user.id === item.userId && user.role === (kind === 'students' ? 'student' : 'staff'));
    const fields = kind === 'institutions'
      ? ['institutionName', 'name', 'phone', 'officialPhone', 'address', 'city', 'state', 'country']
      : kind === 'students'
        ? ['name', 'phone', 'faculty', 'department', 'programme', 'entryLevel', 'level', 'admissionYear', 'admissionStatus', 'matricNo']
        : ['name', 'phone', 'faculty', 'department', 'jobTitle'];
    for (const field of fields) {
      if (!Object.hasOwn(input, field)) continue;
      item[field] = String(input[field] ?? '').trim();
      if (linkedUser && ['name', 'phone'].includes(field)) linkedUser[field] = item[field];
    }
  }

  async function handleLogin(req, res, input) {
    if (!adminEmail || normalizeEmail(input.email) !== adminEmail) return false;
    const account = data.platformAdminAccount;
    if (!account?.passwordHash) {
      send(res, 200, { platformAdminSetupRequired: true });
      return true;
    }
    if (!await verifyPassword(String(input.password || ''), account.passwordHash)) {
      send(res, 401, { error: 'Email or password is incorrect.' });
      return true;
    }
    const code = String(crypto.randomInt(100000, 1000000));
    try { await sendOtpEmail(adminEmail, 'Administrator', code, 'sign in to your ClearanceLink platform admin account'); }
    catch (error) {
      console.error('Platform admin OTP email failed:', error.message);
      send(res, 502, { error: 'We could not send the admin sign-in code. Please try again.' });
      return true;
    }
    const challengeId = crypto.randomBytes(24).toString('hex');
    data.platformAdminLogins ||= [];
    data.platformAdminLogins = data.platformAdminLogins.filter((item) => item.expiresAt > Date.now());
    data.platformAdminLogins.push({ tokenHash: sha(challengeId), codeHash: sha(code), expiresAt: Date.now() + 5 * 60_000, attempts: 0 });
    save();
    send(res, 200, { platformAdminOtpRequired: true, challengeId, maskedContact: `${adminEmail.slice(0, 2)}***@${adminEmail.split('@')[1]}` });
    return true;
  }

  return {
    handleLogin,
    handleAuthMe(token) {
      const session = data.sessions.find((item) => item.tokenHash === sha(token) && item.role === 'platform-admin' && item.expiresAt > Date.now());
      return session ? adminUser() : null;
    },
    async handle(req, res, route) {
      if (!route.startsWith('/api/platform-admin/')) return false;
      const input = req.method === 'POST' || req.method === 'PATCH' ? await readJson(req) : {};
      if (!adminEmail) return send(res, 503, { error: 'Platform admin email is not configured on the server.' }), true;

      if (route === '/api/platform-admin/setup/request' && req.method === 'POST') {
        const email = normalizeEmail(input.email);
        if (email !== adminEmail || data.platformAdminAccount?.passwordHash) return send(res, 200, { sent: true }), true;
        const code = String(crypto.randomInt(100000, 1000000));
        try { await sendOtpEmail(email, 'Administrator', code, 'set up your ClearanceLink platform admin password'); }
        catch (error) {
          console.error('Platform admin setup OTP email failed:', error.message);
          return send(res, 502, { error: 'We could not send the setup code. Please try again.' }), true;
        }
        data.platformAdminSetupOtp = { codeHash: sha(code), expiresAt: Date.now() + 5 * 60_000, attempts: 0 };
        save();
        return send(res, 200, { sent: true, maskedContact: `${email.slice(0, 2)}***@${email.split('@')[1]}` }), true;
      }
      if (route === '/api/platform-admin/setup/complete' && req.method === 'POST') {
        const otp = data.platformAdminSetupOtp;
        if (normalizeEmail(input.email) !== adminEmail || data.platformAdminAccount?.passwordHash) return send(res, 400, { error: 'Admin setup is unavailable. Request a new code or sign in.' }), true;
        if (!otp || otp.expiresAt < Date.now() || otp.attempts >= 5) return send(res, 400, { error: 'The code expired or setup is unavailable. Request a new code.' }), true;
        if (otp.codeHash !== sha(input.code)) { otp.attempts += 1; save(); return send(res, 400, { error: 'That code is incorrect.' }), true; }
        if (!passwordIsStrong(input.password)) return send(res, 400, { error: 'Password needs 8 characters, an uppercase letter, a number and a symbol.' }), true;
        data.platformAdminAccount = { email: adminEmail, passwordHash: await hashPassword(input.password), createdAt: new Date().toISOString() };
        delete data.platformAdminSetupOtp;
        record({ email: adminEmail }, 'Platform admin account set up', adminEmail);
        const session = newSession();
        return send(res, 201, session), true;
      }
      if (route === '/api/platform-admin/login/verify' && req.method === 'POST') {
        const challenge = data.platformAdminLogins?.find((item) => item.tokenHash === sha(input.challengeId) && item.expiresAt > Date.now());
        if (!challenge || challenge.attempts >= 5) return send(res, 400, { error: 'The code expired. Sign in again to request a new one.' }), true;
        if (challenge.codeHash !== sha(input.code)) { challenge.attempts += 1; save(); return send(res, 400, { error: 'That code is incorrect.' }), true; }
        data.platformAdminLogins = data.platformAdminLogins.filter((item) => item !== challenge);
        const session = newSession();
        return send(res, 200, session), true;
      }

      const actor = authorized(req);
      if (!actor) return send(res, 401, { error: 'Platform admin sign-in required.' }), true;
      const pathParts = route.split('/').filter(Boolean);
      if (route === '/api/platform-admin/overview' && req.method === 'GET') {
        return send(res, 200, {
          students: data.students.length, staff: data.staff.length,
          institutions: data.users.filter((item) => item.role === 'institution').length,
          openErrors: (data.bugReports || []).filter((item) => item.status !== 'resolved').length,
          recentAudit: (data.platformAdminAudit || []).slice(0, 30),
        }), true;
      }
      if (route === '/api/platform-admin/accounts' && req.method === 'GET') {
        const kind = new URL(req.url, 'http://localhost').searchParams.get('kind');
        if (!['students', 'staff', 'institutions'].includes(kind)) return send(res, 400, { error: 'Choose students, staff or institutions.' }), true;
        const query = normalizeEmail(new URL(req.url, 'http://localhost').searchParams.get('q'));
        const items = accountList(kind).filter((item) => !query || `${item.name} ${item.email} ${item.institutionName || ''}`.toLowerCase().includes(query));
        return send(res, 200, { items: items.slice(0, 500) }), true;
      }
      if (pathParts[2] === 'accounts' && pathParts[3] && req.method === 'PATCH') {
        const kind = String(input.kind || '');
        const item = resolveAccount(kind, pathParts[3]);
        if (!item) return send(res, 404, { error: 'Account not found.' }), true;
        patchAccount(kind, item, input);
        record(actor, 'Account updated', `${kind}:${item.id}`);
        save();
        return send(res, 200, { item: accountList(kind).find((row) => row.id === item.id) }), true;
      }
      if (pathParts[2] === 'accounts' && pathParts[3] && pathParts[4] === 'status' && req.method === 'PATCH') {
        const kind = String(input.kind || '');
        const item = resolveAccount(kind, pathParts[3]);
        if (!item || !['students', 'staff'].includes(kind)) return send(res, 404, { error: 'Account not found.' }), true;
        item.disabled = Boolean(input.disabled);
        const linkedUser = item.userId && data.users.find((user) => user.id === item.userId);
        if (linkedUser && input.disabled) data.sessions = data.sessions.filter((session) => session.userId !== linkedUser.id);
        record(actor, item.disabled ? 'Account disabled' : 'Account restored', `${kind}:${item.id}`);
        save();
        return send(res, 200, { item: accountList(kind).find((row) => row.id === item.id) }), true;
      }
      if (pathParts[2] === 'accounts' && pathParts[3] && pathParts[4] === 'institution-access' && req.method === 'POST') {
        const item = resolveAccount('institutions', pathParts[3]);
        if (!item) return send(res, 404, { error: 'Institution not found.' }), true;
        if (input.grant) {
          if (!item.adminAccess?.active) item.adminAccess = { active: true, grantedAt: new Date().toISOString(), grantedBy: actor.email, previous: { status: item.status, plan: item.plan, trialEndsAt: item.trialEndsAt, subscriptionEndsAt: item.subscriptionEndsAt } };
          item.status = 'verified';
          item.plan = 'admin-access';
        } else if (item.adminAccess?.active) {
          const previous = item.adminAccess.previous || {};
          for (const field of ['status', 'plan', 'trialEndsAt', 'subscriptionEndsAt']) {
            if (previous[field] === undefined) delete item[field]; else item[field] = previous[field];
          }
          delete item.adminAccess;
        }
        record(actor, input.grant ? 'Institution access granted without payment' : 'Institution admin access revoked', item.institutionName);
        save();
        return send(res, 200, { item: accountList('institutions').find((row) => row.id === item.id) }), true;
      }
      if (pathParts[2] === 'staff' && pathParts[3] && pathParts[4] === 'role' && req.method === 'POST') {
        const staff = data.staff.find((item) => item.id === pathParts[3] && !item.disabled);
        if (!staff) return send(res, 404, { error: 'Active staff member not found.' }), true;
        if (!String(input.department || '').trim() || !/^\d{3}$/.test(String(input.level || '')) || !/^\d{4}\/\d{4}$/.test(String(input.session || ''))) return send(res, 400, { error: 'Department, three-digit level and academic session are required.' }), true;
        staff.role = 'officer';
        staff.scope = { faculty: String(input.faculty || '').trim(), department: String(input.department).trim(), level: String(input.level), session: String(input.session), assignedAt: new Date().toISOString(), assignedBy: actor.email };
        record(actor, 'Staff clearance role assigned', staff.name, `${staff.scope.department} / ${staff.scope.level} / ${staff.scope.session}`);
        save();
        return send(res, 200, { item: accountList('staff').find((row) => row.id === staff.id) }), true;
      }
      if (pathParts[2] === 'staff' && pathParts[3] && pathParts[4] === 'role' && req.method === 'DELETE') {
        const staff = data.staff.find((item) => item.id === pathParts[3]);
        if (!staff) return send(res, 404, { error: 'Staff member not found.' }), true;
        staff.role = null; staff.scope = null; staff.assignments = [];
        record(actor, 'Staff clearance role revoked', staff.name);
        save();
        return send(res, 200, { item: accountList('staff').find((row) => row.id === staff.id) }), true;
      }
      if (route === '/api/platform-admin/email-change/request' && req.method === 'POST') {
        const kind = String(input.kind || '');
        const item = resolveAccount(kind, String(input.id || ''));
        const newEmail = normalizeEmail(input.newEmail);
        if (!item || !/^\S+@\S+\.\S+$/.test(newEmail)) return send(res, 400, { error: 'Select an account and enter a valid new email.' }), true;
        const linkedUser = kind === 'institutions' ? item : data.users.find((user) => user.id === item.userId);
        if (emailTaken(newEmail, linkedUser?.id, { kind, id: item.id })) return send(res, 409, { error: 'That email is already in use.' }), true;
        const code = String(crypto.randomInt(100000, 1000000));
        try {
          await sendOtpEmail(newEmail, item.name || item.institutionName || 'there', code, 'confirm your updated ClearanceLink account email');
          if (item.email && sendEmailChangeNotice) await sendEmailChangeNotice(item.email, item.name || item.institutionName || '', newEmail);
        } catch (error) {
          console.error('Platform admin email-change notification failed:', error.message);
          return send(res, 502, { error: 'We could not send the verification email. No account email was changed.' }), true;
        }
        data.platformAdminEmailChanges ||= [];
        data.platformAdminEmailChanges = data.platformAdminEmailChanges.filter((change) => change.expiresAt > Date.now() && !(change.kind === kind && change.accountId === item.id));
        const changeId = crypto.randomUUID();
        data.platformAdminEmailChanges.push({ id: changeId, kind, accountId: item.id, userId: linkedUser?.id || null, email: newEmail, codeHash: sha(code), expiresAt: Date.now() + 5 * 60_000, attempts: 0, requestedBy: actor.email });
        save();
        return send(res, 200, { changeId, message: 'Verification code sent to the new email address.' }), true;
      }
      if (route === '/api/platform-admin/email-change/confirm' && req.method === 'POST') {
        const change = data.platformAdminEmailChanges?.find((item) => item.id === input.changeId && item.expiresAt > Date.now());
        if (!change || change.attempts >= 5) return send(res, 400, { error: 'Email change request expired. Request a new code.' }), true;
        if (change.codeHash !== sha(input.code)) { change.attempts += 1; save(); return send(res, 400, { error: 'That code is incorrect.' }), true; }
        if (emailTaken(change.email, change.userId, { kind: change.kind, id: change.accountId })) return send(res, 409, { error: 'That email has since been assigned to another account.' }), true;
        if (!setAccountEmail(change.kind, change.accountId, change.email)) return send(res, 404, { error: 'Account not found.' }), true;
        data.platformAdminEmailChanges = data.platformAdminEmailChanges.filter((item) => item !== change);
        record(actor, 'Account email changed after OTP confirmation', `${change.kind}:${change.accountId}`, change.email);
        save();
        return send(res, 200, { message: 'Email address updated.' }), true;
      }
      if (route === '/api/platform-admin/errors' && req.method === 'GET') {
        return send(res, 200, { items: (data.bugReports || []).slice(-300).reverse() }), true;
      }
      if (pathParts[2] === 'errors' && pathParts[3] && req.method === 'PATCH') {
        const report = (data.bugReports || []).find((item) => item.id === pathParts[3]);
        if (!report) return send(res, 404, { error: 'Error report not found.' }), true;
        report.status = input.resolved ? 'resolved' : 'open';
        report.resolvedAt = input.resolved ? new Date().toISOString() : null;
        record(actor, input.resolved ? 'Error report marked resolved' : 'Error report reopened', report.id);
        save();
        return send(res, 200, { item: report }), true;
      }
      if (route === '/api/platform-admin/audit' && req.method === 'GET') {
        return send(res, 200, { items: (data.platformAdminAudit || []).slice(0, 200) }), true;
      }
      return send(res, 404, { error: 'Platform admin endpoint not found.' }), true;
    },
  };
}

module.exports = { createPlatformAdmin };
