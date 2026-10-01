const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { sendOtpEmail, sendWelcomeEmail } = require('./mailer');
const { stampDocument } = require('./stamp');
const { pushTo } = require('./push');


const PASSWORD_RULE = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const ALLOWED_TYPES = { 'application/pdf': 'PDF', 'image/jpeg': 'JPG', 'image/png': 'PNG' };
const sha = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const upload = (id, name, hint, maxMb = 5) => ({ id, name, hint, kind: 'upload', formats: ['PDF', 'JPG', 'PNG'], maxMb });

function simpleClearance(id, name, stageNames, requirementName) {
  return {
    id, name, session: '2026/2027', description: `Complete all ${name.toLowerCase()} requirements.`,
    stages: stageNames.map((stageName, index) => ({ id: `${id}-s${index + 1}`, name: stageName, requirements: [upload(`${id}-r${index + 1}`, `${stageName} ${requirementName}`)] })),
  };
}

function seedData(data) {
  if (data.clearances?.length) return;
  data.students ||= [];
  data.clearances = [
    {
      id: 'new-student', name: 'New Student Clearance', session: '2026/2027', description: 'Complete all clearance stages to finish onboarding.',
      stages: [
        { id: 'admission', name: 'Admission', requirements: [upload('admission-letter', 'Admission Letter', 'PDF, JPG (Max 5MB)')] },
        { id: 'department', name: 'Department', requirements: [
          upload('department-form', 'Department Form', 'PDF, JPG (Max 5MB)'),
          upload('olevel-result', "O'Level Result", 'PDF, JPG (Max 5MB)'),
          upload('passport-photo', 'Passport Photograph', 'JPG, PNG (Max 2MB)', 2),
        ] },
        { id: 'tuition', name: 'Tuition', requirements: [{ id: 'tuition-status', name: 'Tuition Status', hint: 'Verified by the institution from its own records', kind: 'institution' }] },
        { id: 'ict', name: 'ICT', requirements: [upload('ict-slip', 'ICT Registration Slip', 'PDF, JPG (Max 5MB)')] },
        { id: 'registry', name: 'Registry', requirements: [upload('registry-form', 'Registry Biodata Form', 'PDF, JPG (Max 5MB)')] },
      ],
      completion: {
        idCard: { title: 'Student ID Card', mode: 'physical', status: 'Ready for Collection', location: 'Student Affairs Office', date: 'To be announced', hours: 'Mon-Fri, 9:00 AM - 4:00 PM', instructions: 'Bring a printed copy of your clearance certificate.' },
        matric: { title: 'Matriculation Number', status: 'To be Assigned' },
        certificate: { title: 'Clearance Certificate', status: 'Available' },
      },
    },
    simpleClearance('hostel', 'Hostel Clearance', ['Application', 'Room Allocation', 'Caution Fee', 'Handover'], 'Document'),
    simpleClearance('medical', 'Medical Clearance', ['Medical Report', 'Immunisation', 'Health Centre'], 'Document'),
    simpleClearance('library', 'Library Clearance', ['Registration', 'Books Return'], 'Document'),
  ];
  data.submissions = [];
  data.notifications = [];
  data.otps = [];
  data.activations = [];
  data.completions = [];
  data.audit = [];
}

function maskEmail(email) {
  const [name, domain] = email.split('@');
  return `${name.slice(0, 3)}${'*'.repeat(4)}@${domain}`;
}

function createHandler({ data, save, send, readJson, hashPassword, publicUser, files, isProduction }) {
  seedData(data);
  // People come from the institution (manual entry or spreadsheet import). Drop the old unactivated demo record, if any.
  data.students = (data.students || []).filter((item) => item.institutionId || item.userId);
  for (const key of ['submissions', 'notifications', 'otps', 'activations', 'completions', 'audit']) data[key] ||= [];

  const now = () => new Date().toISOString();
  const audit = (actor, action, target, student) => {
    data.audit.push({ id: crypto.randomUUID(), institutionId: student.institutionId, actor, action, target, institution: student.institutionName, at: now() });
    if (/^(Document uploaded|Document re-uploaded|Document approved|Document rejected|Clearance created|Clearance deleted|Cleared on the ground)$/.test(action)) void pushTo('institution', student.institutionId, action, `${actor}: ${target}`, { type: 'activity' });
  };
  const notify = (student, type, title, body, clearanceId) => {
    data.notifications.unshift({ id: crypto.randomUUID(), studentId: student.id, type, title, body, clearanceId, read: false, createdAt: now() });
    void pushTo('student', student.id, title, body, { type, clearanceId });
  };

  function studentFromRequest(req) {
    const token = String(req.headers.authorization || '').replace(/^Bearer /, '');
    const session = data.sessions.find((item) => item.tokenHash === sha(token) && item.expiresAt > Date.now());
    const user = session && data.users.find((item) => item.id === session.userId && item.role === 'student');
    return user && data.students.find((item) => item.id === user.studentId);
  }

  const latest = (student, requirementId) => data.submissions.filter((item) => item.studentId === student.id && item.requirementId === requirementId).at(-1);
  const requirementStatus = (student, requirement) => {
    const submission = latest(student, requirement.id);
    if (!submission) return 'not_started';
    return { pending: 'pending', resubmitted: 'resubmitted', cleared: 'cleared', rejected: 'action_required' }[submission.status];
  };
  function rollup(statuses) {
    if (statuses.length && statuses.every((s) => s === 'cleared')) return 'cleared';
    if (statuses.includes('action_required')) return 'action_required';
    if (statuses.includes('resubmitted')) return 'resubmitted';
    if (statuses.includes('pending')) return 'pending';
    if (statuses.includes('cleared')) return 'in_progress';
    return 'not_started';
  }
  function describeSubmission(item) {
    return item && { id: item.id, fileId: item.fileId, fileName: item.fileName, mimeType: item.mimeType, size: item.size, status: item.status, reason: item.reason, message: item.message, reviewer: item.reviewer, submittedAt: item.createdAt, reviewedAt: item.reviewedAt, stampedFileId: item.stampedFileId };
  }
  // A clearance belongs to one institution. If an officer created it, it also only applies to students in that officer's scope.
  const visibleTo = (student, clearance) => (clearance.institutionId || null) === (student.institutionId || null)
    && (!clearance.scope || ((!clearance.scope.department || student.department === clearance.scope.department) && (!clearance.scope.level || student.level === clearance.scope.level) && (!clearance.scope.session || student.session === clearance.scope.session)));
  function buildClearance(student, clearance, detail) {
    const stages = clearance.stages.map((stage) => {
      const requirements = stage.requirements.map((requirement) => {
        const history = data.submissions.filter((item) => item.studentId === student.id && item.requirementId === requirement.id);
        return { ...requirement, status: requirementStatus(student, requirement), submission: describeSubmission(history.at(-1)), history: detail ? history.map(describeSubmission).reverse() : undefined };
      });
      return { id: stage.id, name: stage.name, status: rollup(requirements.map((item) => item.status)), requirements };
    });
    const done = stages.filter((stage) => stage.status === 'cleared').length;
    const allDocs = stages.flatMap((stage) => stage.requirements);
    const docsDone = allDocs.filter((item) => item.status === 'cleared').length;
    const docsTotal = allDocs.length;
    const status = done === stages.length ? 'completed' : rollup(stages.map((stage) => stage.status));
    const completedAt = data.completions.find((item) => item.studentId === student.id && item.clearanceId === clearance.id)?.at;
    return {
      id: clearance.id, name: clearance.name, session: clearance.session, description: clearance.description, status,
      // Progress counts documents, so a clearance with one stage and several documents moves as each is cleared.
      done: docsDone, total: docsTotal, percent: docsTotal ? Math.round((docsDone / docsTotal) * 100) : 0, stages, completedAt,
      completion: status === 'completed' ? completionFor(student, clearance) : undefined,
    };
  }

  // What the student gets after completing a clearance is decided by their institution (ID card by digital delivery,
  // physical collection or both; certificate; matric number; extra documents; custom instructions).
  function completionFor(student, clearance) {
    const institution = student.institutionId && data.users.find((item) => item.id === student.institutionId && item.role === 'institution');
    if (!institution) {
      // Sample data without an institution keeps the built-in completion template.
      const template = clearance.completion;
      return template ? { ...template, matric: { ...template.matric, status: student.matricNo || template.matric.status, value: student.matricNo } } : undefined;
    }
    const config = { idCardMode: 'none', certificate: true, matric: true, ...(institution.completion || {}) };
    const digital = ['digital', 'both'].includes(config.idCardMode);
    const physical = ['physical', 'both'].includes(config.idCardMode);
    const completion = { documents: (student.officialDocuments || []).map((item) => ({ id: item.id, title: item.title, fileId: item.fileId, mimeType: item.mimeType, fileName: item.name, uploadedAt: item.uploadedAt })) };
    if (digital || physical) {
      completion.idCard = {
        title: 'Student ID Card', digital, physical,
        status: digital ? (student.idCard?.fileId ? 'Ready to View' : 'Being Prepared') : 'Ready for Collection',
        fileId: digital ? student.idCard?.fileId || null : null, mimeType: student.idCard?.mimeType, fileName: student.idCard?.name,
        ...(physical ? { location: config.location, date: config.date, hours: config.hours, instructions: config.instructions } : {}),
      };
    }
    if (config.matric) completion.matric = { title: 'Matriculation Number', status: student.matricNo || 'To be Assigned', value: student.matricNo };
    if (config.certificate) completion.certificate = { title: 'Clearance Certificate', status: 'Available' };
    if (config.custom) completion.custom = config.custom;
    return completion;
  }
  const studentProfile = (student) => ({ id: student.id, name: student.name, email: student.email, phone: student.phone, clearanceId: student.clearanceId, jamb: student.jamb, faculty: student.faculty, department: student.department, programme: student.programme, level: student.level, admissionYear: student.admissionYear, matricNo: student.matricNo, institutionName: student.institutionName, session: student.session });

  function checkCompletion(student, clearance) {
    const built = buildClearance(student, clearance, false);
    if (built.status !== 'completed' || data.completions.some((item) => item.studentId === student.id && item.clearanceId === clearance.id)) return;
    data.completions.push({ studentId: student.id, clearanceId: clearance.id, at: now() });
    notify(student, 'completed', 'Clearance completed', `You have completed ${clearance.name}.`, clearance.id);
    const idCard = completionFor(student, clearance)?.idCard;
    if (idCard?.physical || (idCard && idCard.physical === undefined && idCard.location)) notify(student, 'idcard', 'Collection instructions', idCard.location ? `Collect your ID card at ${idCard.location}.` : 'Your ID card is ready for collection. Your institution will share the details.', clearance.id);
  }

  // When a document is cleared, produce a stamped PDF copy carrying the institution's stamp and the reviewer's
  // stamp/signature (whichever have been uploaded). Failure to stamp never blocks the clearance itself.
  async function stampSubmission(student, submission, reviewer) {
    try {
      if (!submission.fileId) return;
      const institution = data.users.find((item) => item.id === student.institutionId && item.role === 'institution');
      const marks = [];
      for (const owner of [institution, reviewer]) {
        if (!owner?.stamp?.fileId) continue;
        const image = await files.get(owner.stamp.fileId);
        if (image) marks.push({ image, mimeType: owner.stamp.mimeType, placement: owner.stamp.placement });
      }
      if (!marks.length) return;
      const source = await files.get(submission.fileId);
      if (!source) return;
      const pdf = await stampDocument({ buffer: source, mimeType: submission.mimeType, marks, reviewer: reviewer?.name || submission.reviewer, date: submission.reviewedAt });
      if (!pdf) return; // only PDF, PNG and JPG documents can be stamped
      const stampedFileId = crypto.randomUUID();
      await files.put(stampedFileId, pdf);
      submission.stampedFileId = stampedFileId;
      submission.stampedAt = now();
    } catch (error) {
      console.error('Stamping failed:', (error && (error.stack || error.message)) || error);
    }
  }

  const core = { visibleTo, latest, notify, audit, buildClearance, studentProfile, checkCompletion, describeSubmission, stampSubmission, sha, now, hooks: { submission: [] } };

  async function handle(req, res, route) {
    if (!route.startsWith('/api/student') && !route.startsWith('/api/files/') && !route.startsWith('/api/dev/')) return false;

    // ---- Activation (public) ----
    if (route === '/api/student/access' && req.method === 'POST') {
      const { clearanceId } = await readJson(req);
      const student = data.students.find((item) => item.clearanceId === String(clearanceId || '').trim().toUpperCase());
      if (!student) return send(res, 404, { error: 'We could not find that Clearance ID. Check it and try again.' }), true;
      if (student.disabled || (student.institutionId && !student.approved)) return send(res, 403, { error: 'This Clearance ID is not available yet. Contact your institution.' }), true;
      if (student.disabled || student.approved === false) return send(res, 403, { error: 'This Clearance ID has not been released yet. Please contact your institution.' }), true;
      if (student.userId) return send(res, 409, { error: 'This account is already activated. Please log in.' }), true;
      const code = String(crypto.randomInt(100000, 1000000));
      try { await sendOtpEmail(student.email, student.name.split(' ')[0], code); }
      catch (cause) {
        console.error('OTP email failed:', cause.message);
        return send(res, 502, { error: /not configured/.test(cause.message) ? 'Email delivery is not set up yet. Please contact your institution.' : 'We could not send the code to your email. Please try again.' }), true;
      }
      data.otps = data.otps.filter((item) => item.studentId !== student.id);
      data.otps.push({ studentId: student.id, codeHash: sha(code), sentAt: Date.now(), expiresAt: Date.now() + 5 * 60_000, attempts: 0 });
      save();
      send(res, 200, { maskedContact: maskEmail(student.email) });
      return true;
    }
    if (route === '/api/student/verify' && req.method === 'POST') {
      const input = await readJson(req);
      const student = data.students.find((item) => item.clearanceId === String(input.clearanceId || '').trim().toUpperCase());
      const otp = student && data.otps.find((item) => item.studentId === student.id);
      if (!otp || otp.expiresAt < Date.now()) return send(res, 400, { error: 'The code has expired. Request a new one.' }), true;
      if (otp.attempts >= 5) return send(res, 429, { error: 'Too many attempts. Request a new code.' }), true;
      if (otp.codeHash !== sha(input.code)) {
        otp.attempts += 1; save();
        return send(res, 400, { error: 'That code is incorrect.' }), true;
      }
      data.otps = data.otps.filter((item) => item !== otp);
      const activationToken = crypto.randomBytes(24).toString('hex');
      data.activations = data.activations.filter((item) => item.studentId !== student.id);
      data.activations.push({ studentId: student.id, tokenHash: sha(activationToken), expiresAt: Date.now() + 15 * 60_000 });
      save();
      send(res, 200, { activationToken });
      return true;
    }
    if (route === '/api/student/activate' && req.method === 'POST') {
      const input = await readJson(req);
      const student = data.students.find((item) => item.clearanceId === String(input.clearanceId || '').trim().toUpperCase());
      const activation = student && data.activations.find((item) => item.studentId === student.id && item.tokenHash === sha(input.activationToken) && item.expiresAt > Date.now());
      if (!activation) return send(res, 400, { error: 'Your verification expired. Please start again.' }), true;
      if (!PASSWORD_RULE.test(String(input.password || ''))) return send(res, 400, { error: 'Password needs 8 characters, an uppercase letter, a number and a symbol.' }), true;
      if (student.userId) return send(res, 409, { error: 'This account is already activated.' }), true;
      const email = student.email.toLowerCase();
      if (data.users.some((item) => item.email === email && item.role === 'student')) return send(res, 409, { error: 'An account with this email already exists.' }), true;
      const user = { id: crypto.randomUUID(), role: 'student', status: 'active', email, passwordHash: hashPassword(input.password), name: student.name, institutionName: student.institutionName, studentId: student.id, createdAt: now() };
      data.users.push(user);
      student.userId = user.id;
      data.activations = data.activations.filter((item) => item !== activation);
      for (const clearance of data.clearances.filter((item) => visibleTo(student, item))) notify(student, 'assigned', 'Clearance assigned', `${clearance.name} ${clearance.session} has been assigned to you.`, clearance.id);
      audit(student.name, 'Student account activated', student.clearanceId, student);
      save();
      sendWelcomeEmail('student', student.email, student.name, student.institutionName).catch((cause) => console.error('Welcome email failed:', cause.message));
      send(res, 201, { user: publicUser(user) });
      return true;
    }

    // ---- Authenticated student routes ----
    const student = studentFromRequest(req);
    if (!student) return send(res, 401, { error: 'Session expired. Please log in again.' }), true;

    // The institution's logo, shown in the student header.
    if (route === '/api/student/logo' && req.method === 'GET') {
      const institution = data.users.find((item) => item.id === student.institutionId && item.role === 'institution');
      const logo = institution?.attachments?.logo;
      const content = logo && await files.get(logo.fileId);
      if (!content) return send(res, 404, { error: 'No institution logo uploaded.' }), true;
      res.writeHead(200, { 'Content-Type': logo.mimeType, 'Cache-Control': 'private, max-age=300' });
      res.end(content); return true;
    }
    if (route === '/api/student/overview' && req.method === 'GET') {
      const clearances = data.clearances.filter((item) => visibleTo(student, item)).map((item) => buildClearance(student, item, false));
      const institution = data.users.find((item) => item.id === student.institutionId && item.role === 'institution');
      send(res, 200, { student: studentProfile(student), hasLogo: Boolean(institution?.attachments?.logo), clearances, unread: data.notifications.filter((item) => item.studentId === student.id && !item.read).length });
      return true;
    }
    const detailMatch = route.match(/^\/api\/student\/clearances\/([\w-]+)$/);
    if (detailMatch && req.method === 'GET') {
      const clearance = data.clearances.find((item) => item.id === detailMatch[1] && visibleTo(student, item));
      if (!clearance) return send(res, 404, { error: 'Clearance not found.' }), true;
      send(res, 200, { student: studentProfile(student), clearance: buildClearance(student, clearance, true) });
      return true;
    }
    if (route === '/api/student/submissions' && req.method === 'POST') {
      const input = await readJson(req, 9_500_000);
      const clearance = data.clearances.find((item) => item.id === input.clearanceId && visibleTo(student, item));
      const requirement = clearance?.stages.flatMap((stage) => stage.requirements).find((item) => item.id === input.requirementId);
      if (!requirement || requirement.kind !== 'upload') return send(res, 404, { error: 'Requirement not found.' }), true;
      const previous = latest(student, requirement.id);
      if (previous && previous.status !== 'rejected') return send(res, 409, { error: 'This document is already submitted.' }), true;
      if (!ALLOWED_TYPES[input.mimeType]) return send(res, 400, { error: 'Only PDF, JPG and PNG files are supported.' }), true;
      const buffer = Buffer.from(String(input.dataBase64 || ''), 'base64');
      if (!buffer.length) return send(res, 400, { error: 'The file is empty.' }), true;
      if (buffer.length > requirement.maxMb * 1024 * 1024) return send(res, 400, { error: `File is larger than ${requirement.maxMb}MB.` }), true;
      const fileId = crypto.randomUUID();
      await files.put(fileId, buffer);
      const submission = { id: crypto.randomUUID(), studentId: student.id, clearanceId: clearance.id, requirementId: requirement.id, fileId, fileName: String(input.fileName || 'document').slice(0, 120), mimeType: input.mimeType, size: buffer.length, status: previous ? 'resubmitted' : 'pending', createdAt: now() };
      data.submissions.push(submission);
      audit(student.name, previous ? 'Document re-uploaded' : 'Document uploaded', `${clearance.name} / ${requirement.name}`, student);
      core.hooks.submission.forEach((hook) => hook(student, clearance, requirement, Boolean(previous)));
      save();
      send(res, 201, { submission: describeSubmission(submission) });
      return true;
    }
    if (route === '/api/student/notifications' && req.method === 'GET') {
      send(res, 200, { notifications: data.notifications.filter((item) => item.studentId === student.id) });
      return true;
    }
    if (route === '/api/student/notifications/read' && req.method === 'POST') {
      data.notifications.filter((item) => item.studentId === student.id).forEach((item) => { item.read = true; });
      save();
      send(res, 200, { ok: true });
      return true;
    }
    const fileMatch = route.match(/^\/api\/files\/([\w-]+)$/);
    if (fileMatch && req.method === 'GET') {
      // The student's own ID card and official documents uploaded by the institution.
      const official = student.idCard?.fileId === fileMatch[1] ? student.idCard : (student.officialDocuments || []).find((item) => item.fileId === fileMatch[1]);
      if (official) {
        const bytes = await files.get(fileMatch[1]);
        if (!bytes) return send(res, 404, { error: 'File not found.' }), true;
        res.writeHead(200, { 'Content-Type': official.mimeType, 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'private, max-age=300' });
        res.end(bytes);
        return true;
      }
      const submission = data.submissions.find((item) => (item.fileId === fileMatch[1] || item.stampedFileId === fileMatch[1]) && item.studentId === student.id);
      if (!submission) return send(res, 404, { error: 'File not found.' }), true;
      const stamped = submission.stampedFileId === fileMatch[1];
      const content = await files.get(fileMatch[1]);
      if (!content) return send(res, 404, { error: 'File not found.' }), true;
      res.writeHead(200, { 'Content-Type': stamped ? 'application/pdf' : submission.mimeType, 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'private, max-age=300' });
      res.end(content);
      return true;
    }

    // ---- Development-only reviewer simulation (no staff app yet) ----
    if (route === '/api/dev/review' && req.method === 'POST') {
      if (isProduction) return send(res, 404, { error: 'Not found.' }), true;
      const input = await readJson(req);
      const clearance = data.clearances.find((item) => item.id === input.clearanceId && visibleTo(student, item));
      const requirement = clearance?.stages.flatMap((stage) => stage.requirements).find((item) => item.id === input.requirementId);
      if (!requirement) return send(res, 404, { error: 'Requirement not found.' }), true;
      let submission = latest(student, requirement.id);
      if (!submission || !['pending', 'resubmitted'].includes(submission.status)) {
        if (requirement.kind !== 'institution' || submission) return send(res, 409, { error: 'Nothing to review.' }), true;
        submission = { id: crypto.randomUUID(), studentId: student.id, clearanceId: clearance.id, requirementId: requirement.id, status: 'pending', createdAt: now() };
        data.submissions.push(submission);
      }
      submission.reviewer = 'Mr. B';
      submission.reviewedAt = now();
      if (input.decision === 'clear') { submission.status = 'cleared'; await stampSubmission(student, submission, null); }
      else {
        submission.status = 'rejected';
        submission.reason = String(input.reason || 'Document incomplete.');
        submission.message = String(input.message || '');
      }
      const isClear = submission.status === 'cleared';
      notify(student, isClear ? 'approved' : 'rejected', isClear ? 'Document approved' : 'Document rejected', isClear ? `${requirement.name} has been cleared.` : `${requirement.name} was rejected. Re-upload required.`, clearance.id);
      audit('Mr. B', isClear ? 'Document approved' : 'Document rejected', `${clearance.name} / ${requirement.name}`, student);
      checkCompletion(student, clearance);
      save();
      send(res, 200, { ok: true });
      return true;
    }
    return false;
  }
  handle.core = core;
  return handle;
}

module.exports = { createHandler };
