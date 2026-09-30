const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { sendOtpEmail, sendWelcomeEmail } = require('./mailer');
const { saveStamp, removeStamp } = require('./stamp');

const PASSWORD_RULE = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const REASONS = ['Document is unreadable', 'Wrong document', 'Incomplete document', 'Information does not match', 'Other'];

const maskEmail = (email) => `${email.split('@')[0].slice(0, 1)}${'*'.repeat(8)}@${email.split('@')[1]}`;

function createHandler({ data, save, send, readJson, hashPassword, publicUser, files, studentCore: core }) {
  // Staff come from the institution (manual entry or spreadsheet import); an officer's scope is assigned by the
  // Institution Admin. Drop the old unactivated demo record, if any.
  data.staff ||= [];
  data.staff = data.staff.filter((item) => item.institutionId || item.userId);
  for (const key of ['staffOtps', 'staffActivations', 'staffNotifications']) data[key] ||= [];
  save();

  const { latest, notify, audit, describeSubmission, sha, now } = core;
  const notifyStaff = (staff, type, title, body) => data.staffNotifications.unshift({ id: crypto.randomUUID(), staffId: staff.id, type, title, body, read: false, createdAt: now() });

  const inScope = (staff, student) => Boolean(staff.scope) && (staff.institutionId || null) === (student.institutionId || null) && student.department === staff.scope.department && student.level === staff.scope.level && student.session === staff.scope.session;
  function reviewable(staff) {
    return (staff.assignments || []).flatMap((assignment) => {
      const clearance = data.clearances.find((item) => item.id === assignment.clearanceId);
      if (!clearance || !staff.scope || (staff.institutionId || null) !== (clearance.institutionId || null) || clearance.session !== staff.scope.session) return [];
      return clearance.stages.flatMap((stage) => stage.requirements
        .filter((requirement) => requirement.kind === 'upload' && (!assignment.requirementIds || assignment.requirementIds.includes(requirement.id)))
        .map((requirement) => ({ clearance, stage, requirement })));
    });
  }
  function summarize(staff, student) {
    const items = reviewable(staff).map((entry) => ({ ...entry, sub: latest(student, entry.requirement.id) }));
    const has = (...statuses) => items.some((item) => item.sub && statuses.includes(item.sub.status));
    let group = 'none';
    if (has('pending', 'resubmitted')) group = 'pending';
    else if (has('rejected')) group = 'action';
    else if (items.length && items.every((item) => item.sub?.status === 'cleared')) group = 'cleared';
    const submittedAt = items.map((item) => item.sub?.createdAt).filter(Boolean).sort().at(-1);
    return { items, group, submittedAt };
  }
  const row = (staff, student) => {
    const { group, submittedAt } = summarize(staff, student);
    return { id: student.id, name: student.name, clearanceId: student.clearanceId, jamb: student.jamb, department: student.department, level: student.level, group, submittedAt };
  };
  const passportFor = (student) => {
    const sub = latest(student, 'passport-photo');
    return sub?.fileId && sub.mimeType.startsWith('image/') ? sub.fileId : null;
  };

  function staffFromRequest(req) {
    const token = String(req.headers.authorization || '').replace(/^Bearer /, '');
    const session = data.sessions.find((item) => item.tokenHash === sha(token) && item.expiresAt > Date.now());
    const user = session && data.users.find((item) => item.id === session.userId && item.role === 'staff');
    const staff = user && data.staff.find((item) => item.id === user.staffId);
    return staff?.status === 'active' && !staff.disabled ? staff : null;
  }
  const staffProfile = (staff) => ({ id: staff.id, name: staff.name, email: staff.email, phone: staff.phone, staffId: staff.staffId, accessId: staff.accessId, faculty: staff.faculty, department: staff.department, jobTitle: staff.jobTitle, role: staff.role, scope: staff.scope || { department: staff.department, level: '—', session: 'Not assigned' }, institutionName: staff.institutionName });

  core.hooks.submission.push((student, clearance, requirement, resubmitted) => {
    for (const staff of data.staff) {
      if (staff.status !== 'active' || !inScope(staff, student)) continue;
      if (!reviewable(staff).some((entry) => entry.requirement.id === requirement.id && entry.clearance.id === clearance.id)) continue;
      notifyStaff(staff, resubmitted ? 'resubmission' : 'submission', resubmitted ? 'Re-submission' : 'New submission', `${student.name} ${resubmitted ? 're-submitted' : 'submitted'} ${requirement.name}.`);
    }
  });

  return async function handle(req, res, route) {
    if (!route.startsWith('/api/staff')) return false;
    const idFrom = (input) => String(input.accessId || '').trim().toUpperCase();

    // ---- Activation (public) ----
    if (route === '/api/staff/access' && req.method === 'POST') {
      const input = await readJson(req);
      const staff = data.staff.find((item) => item.accessId === idFrom(input));
      if (!staff || staff.status !== 'active' || staff.disabled) return send(res, 404, { error: 'We could not find that Staff Access ID. Check it and try again.' }), true;
      if (staff.userId) return send(res, 409, { error: 'This account is already activated. Please log in.' }), true;
      const recent = data.staffOtps.find((item) => item.staffId === staff.id && Date.now() - item.sentAt < 5 * 60_000);
      if (recent) return send(res, 429, { error: `Your code is still valid. You can request a new one in ${Math.ceil((5 * 60_000 - (Date.now() - recent.sentAt)) / 60_000)} min.` }), true;
      const code = String(crypto.randomInt(100000, 1000000));
      try { await sendOtpEmail(staff.email, staff.name.replace(/^(Mr|Mrs|Ms|Dr|Prof)\.?\s+/i, '').split(' ')[0], code, 'activate your ClearanceLink staff account'); }
      catch (cause) {
        console.error('Staff OTP email failed:', cause.message);
        return send(res, 502, { error: /not configured/.test(cause.message) ? 'Email delivery is not set up yet. Please contact your institution administrator.' : 'We could not send the code to your email. Please try again.' }), true;
      }
      data.staffOtps = data.staffOtps.filter((item) => item.staffId !== staff.id);
      data.staffOtps.push({ staffId: staff.id, codeHash: sha(code), sentAt: Date.now(), expiresAt: Date.now() + 5 * 60_000, attempts: 0 });
      save();
      send(res, 200, { maskedContact: maskEmail(staff.email) });
      return true;
    }
    if (route === '/api/staff/verify' && req.method === 'POST') {
      const input = await readJson(req);
      const staff = data.staff.find((item) => item.accessId === idFrom(input));
      const otp = staff && data.staffOtps.find((item) => item.staffId === staff.id);
      if (!otp || otp.expiresAt < Date.now()) return send(res, 400, { error: 'The code has expired. Request a new one.' }), true;
      if (otp.attempts >= 5) return send(res, 429, { error: 'Too many attempts. Request a new code.' }), true;
      if (otp.codeHash !== sha(input.code)) { otp.attempts += 1; save(); return send(res, 400, { error: 'That code is incorrect.' }), true; }
      data.staffOtps = data.staffOtps.filter((item) => item !== otp);
      const activationToken = crypto.randomBytes(24).toString('hex');
      data.staffActivations = data.staffActivations.filter((item) => item.staffId !== staff.id);
      data.staffActivations.push({ staffId: staff.id, tokenHash: sha(activationToken), expiresAt: Date.now() + 15 * 60_000 });
      save();
      send(res, 200, { activationToken });
      return true;
    }
    if (route === '/api/staff/activate' && req.method === 'POST') {
      const input = await readJson(req);
      const staff = data.staff.find((item) => item.accessId === idFrom(input));
      const activation = staff && data.staffActivations.find((item) => item.staffId === staff.id && item.tokenHash === sha(input.activationToken) && item.expiresAt > Date.now());
      if (!activation) return send(res, 400, { error: 'Your verification expired. Please start again.' }), true;
      if (!PASSWORD_RULE.test(String(input.password || ''))) return send(res, 400, { error: 'Password needs 8 characters, an uppercase letter, a number and a symbol.' }), true;
      if (staff.userId) return send(res, 409, { error: 'This account is already activated.' }), true;
      const email = staff.email.toLowerCase();
      if (data.users.some((item) => item.email === email && item.role === 'staff')) return send(res, 409, { error: 'An account with this email already exists.' }), true;
      const user = { id: crypto.randomUUID(), role: 'staff', status: 'active', email, passwordHash: hashPassword(input.password), name: staff.name, institutionName: staff.institutionName, staffId: staff.id, createdAt: now() };
      data.users.push(user);
      staff.userId = user.id;
      data.staffActivations = data.staffActivations.filter((item) => item !== activation);
      if (staff.scope) notifyStaff(staff, 'role', 'Clearance role assigned', `You are a ${staff.jobTitle} for ${staff.scope.department}, ${staff.scope.level} Level, ${staff.scope.session}.`);
      const token = crypto.randomBytes(32).toString('hex');
      data.sessions.push({ tokenHash: sha(token), userId: user.id, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 });
      save();
      sendWelcomeEmail('staff', staff.email, staff.name, staff.institutionName).catch((cause) => console.error('Welcome email failed:', cause.message));
      send(res, 201, { token, user: publicUser(user) });
      return true;
    }

    // ---- Authenticated staff routes ----
    const staff = staffFromRequest(req);
    if (!staff) return send(res, 401, { error: 'Session expired. Please log in again.' }), true;
    const scoped = () => data.students.filter((student) => inScope(staff, student));

    // ---- Digital stamp / signature ----
    if (route === '/api/staff/stamp' && req.method === 'GET') {
      send(res, 200, { stamp: staff.stamp ? { name: staff.stamp.name, mimeType: staff.stamp.mimeType, size: staff.stamp.size, updatedAt: staff.stamp.updatedAt } : null });
      return true;
    }
    if (route === '/api/staff/stamp/image' && req.method === 'GET') {
      const content = staff.stamp?.fileId && await files.get(staff.stamp.fileId);
      if (!content) return send(res, 404, { error: 'No stamp uploaded.' }), true;
      res.writeHead(200, { 'Content-Type': staff.stamp.mimeType, 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-cache' });
      res.end(content);
      return true;
    }
    if (route === '/api/staff/stamp' && req.method === 'PUT') {
      try {
        const stamp = await saveStamp({ files, owner: staff, input: await readJson(req, 3_000_000), now });
        audit(staff.name, 'Stamp uploaded', staff.name, { institutionName: staff.institutionName });
        save();
        send(res, 200, { stamp: { name: stamp.name, mimeType: stamp.mimeType, size: stamp.size, updatedAt: stamp.updatedAt } });
      } catch (error) {
        send(res, error.status || 400, { error: error.status ? error.message : 'Request is too large or invalid.' });
      }
      return true;
    }
    if (route === '/api/staff/stamp' && req.method === 'DELETE') {
      await removeStamp({ files, owner: staff });
      audit(staff.name, 'Stamp removed', staff.name, { institutionName: staff.institutionName });
      save();
      send(res, 200, { stamp: null });
      return true;
    }

    if (route === '/api/staff/overview' && req.method === 'GET') {
      const counts = { pending: 0, resubmitted: 0, action: 0, cleared: 0, total: 0 };
      const reviewItems = reviewable(staff);
      for (const student of scoped()) {
        for (const { requirement } of reviewItems) {
          counts.total += 1;
          const status = latest(student, requirement.id)?.status;
          if (status === 'pending') counts.pending += 1;
          else if (status === 'resubmitted') counts.resubmitted += 1;
          else if (status === 'rejected') counts.action += 1;
          else if (status === 'cleared') counts.cleared += 1;
        }
      }
      const clearances = staff.assignments.map((assignment) => data.clearances.find((item) => item.id === assignment.clearanceId)).filter(Boolean).map((clearance) => {
        const own = reviewItems.filter((entry) => entry.clearance.id === clearance.id);
        let total = 0; let cleared = 0; let pending = 0;
        for (const student of scoped()) for (const { requirement } of own) {
          total += 1;
          const status = latest(student, requirement.id)?.status;
          if (status === 'cleared') cleared += 1;
          if (status === 'pending' || status === 'resubmitted') pending += 1;
        }
        return { id: clearance.id, name: clearance.name, session: clearance.session, percent: total ? Math.round((cleared / total) * 100) : 0, pending };
      });
      const unread = data.staffNotifications.filter((item) => item.staffId === staff.id && !item.read).length;
      send(res, 200, { staff: staffProfile(staff), counts, clearances, unread, chipCounts: (() => {
        const groups = scoped().map((student) => summarize(staff, student).group);
        return { pending: groups.filter((g) => g === 'pending').length, action: groups.filter((g) => g === 'action').length, cleared: groups.filter((g) => g === 'cleared').length };
      })() });
      return true;
    }
    if (route === '/api/staff/students' && req.method === 'GET') {
      const url = new URL(req.url, 'http://localhost');
      const group = url.searchParams.get('group') || 'pending';
      const query = (url.searchParams.get('q') || '').trim().toLowerCase();
      let rows = scoped().map((student) => row(staff, student));
      if (query) rows = rows.filter((item) => [item.name, item.clearanceId, item.jamb].some((value) => String(value).toLowerCase().includes(query)));
      else rows = rows.filter((item) => item.group === group);
      rows.sort((a, b) => String(b.submittedAt || '').localeCompare(String(a.submittedAt || '')));
      const withPhoto = rows.map((item) => ({ ...item, photoFileId: passportFor(data.students.find((s) => s.id === item.id)) }));
      send(res, 200, { students: withPhoto });
      return true;
    }
    const studentMatch = route.match(/^\/api\/staff\/students\/([\w-]+)$/);
    if (studentMatch && req.method === 'GET') {
      const student = scoped().find((item) => item.id === studentMatch[1]);
      if (!student) return send(res, 404, { error: 'Student not found in your scope.' }), true;
      const { items, group } = summarize(staff, student);
      const documents = items.map(({ clearance, stage, requirement, sub }) => ({ clearanceId: clearance.id, clearanceName: clearance.name, stage: stage.name, requirementId: requirement.id, name: requirement.name, submission: describeSubmission(sub) }));
      const history = data.submissions
        .filter((sub) => sub.studentId === student.id && items.some((item) => item.requirement.id === sub.requirementId))
        .flatMap((sub) => {
          const name = items.find((item) => item.requirement.id === sub.requirementId).requirement.name;
          const events = [{ id: `${sub.id}-up`, at: sub.createdAt, title: `${name} submitted`, detail: sub.fileName }];
          if (sub.reviewedAt) events.push({ id: `${sub.id}-rev`, at: sub.reviewedAt, title: `${name} ${sub.status === 'cleared' ? 'cleared' : 'rejected'}`, detail: `${sub.reviewer || ''}${sub.reason ? ` · ${sub.reason}` : ''}` });
          return events;
        })
        .sort((a, b) => b.at.localeCompare(a.at));
      send(res, 200, { student: { ...core.studentProfile(student), group, photoFileId: passportFor(student) }, documents, history });
      return true;
    }
    const fileMatch = route.match(/^\/api\/staff\/files\/([\w-]+)$/);
    if (fileMatch && req.method === 'GET') {
      const submission = data.submissions.find((item) => item.fileId === fileMatch[1] || item.stampedFileId === fileMatch[1]);
      const student = submission && data.students.find((item) => item.id === submission.studentId);
      if (!student || !inScope(staff, student) || !reviewable(staff).some((entry) => entry.requirement.id === submission.requirementId)) return send(res, 404, { error: 'File not found.' }), true;
      const stamped = submission.stampedFileId === fileMatch[1];
      const content = await files.get(fileMatch[1]);
      if (!content) return send(res, 404, { error: 'File not found.' }), true;
      const downloadName = stamped ? `${submission.fileName.replace(/\.[^.]+$/, '')}-stamped.pdf` : submission.fileName;
      res.writeHead(200, { 'Content-Type': stamped ? 'application/pdf' : submission.mimeType, 'Content-Disposition': `inline; filename="${downloadName.replace(/"/g, '')}"`, 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'private, max-age=300' });
      res.end(content);
      return true;
    }
    if (route === '/api/staff/review' && req.method === 'POST') {
      const input = await readJson(req);
      const student = scoped().find((item) => item.id === input.studentId);
      if (!student) return send(res, 403, { error: 'This student is outside your assigned scope.' }), true;
      if (!['clear', 'reject'].includes(input.decision)) return send(res, 400, { error: 'Choose clear or reject.' }), true;
      if (input.decision === 'reject') {
        if (!REASONS.includes(input.reason)) return send(res, 400, { error: 'Select a reason for rejection.' }), true;
        if (!String(input.message || '').trim()) return send(res, 400, { error: 'Add a message for the student.' }), true;
      }
      const allowed = reviewable(staff);
      const targets = (Array.isArray(input.requirementIds) ? input.requirementIds : []).map((requirementId) => {
        const entry = allowed.find((item) => item.requirement.id === requirementId);
        const sub = entry && latest(student, requirementId);
        return entry && sub && ['pending', 'resubmitted'].includes(sub.status) ? { entry, sub } : null;
      });
      if (!targets.length || targets.some((item) => !item)) return send(res, 409, { error: 'Nothing pending to review, or a document is outside your responsibilities.' }), true;
      for (const { entry, sub } of targets) {
        sub.reviewer = staff.name;
        sub.reviewedAt = now();
        if (input.decision === 'clear') { sub.status = 'cleared'; sub.note = String(input.message || '').trim() || undefined; await core.stampSubmission(student, sub, staff); }
        else { sub.status = 'rejected'; sub.reason = input.reason; sub.message = String(input.message).trim(); }
        const cleared = input.decision === 'clear';
        notify(student, cleared ? 'approved' : 'rejected', cleared ? 'Document approved' : 'Document rejected', cleared ? `${entry.requirement.name} has been cleared.` : `${entry.requirement.name} was rejected. Re-upload required.`, entry.clearance.id);
        audit(staff.name, cleared ? 'Document approved' : 'Document rejected', `${student.name} / ${entry.clearance.name} / ${entry.requirement.name}`, student);
        core.checkCompletion(student, entry.clearance);
      }
      save();
      send(res, 200, { ok: true, count: targets.length });
      return true;
    }
    if (route === '/api/staff/notifications' && req.method === 'GET') {
      send(res, 200, { notifications: data.staffNotifications.filter((item) => item.staffId === staff.id) });
      return true;
    }
    if (route === '/api/staff/notifications/read' && req.method === 'POST') {
      data.staffNotifications.filter((item) => item.staffId === staff.id).forEach((item) => { item.read = true; });
      save();
      send(res, 200, { ok: true });
      return true;
    }
    return false;
  };
}

module.exports = { createHandler, REASONS };
