const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { Readable } = require('node:stream');
const ExcelJS = require('exceljs');
const { sendAccessIdEmail } = require('./mailer');
const { saveStamp, removeStamp } = require('./stamp');
const { plans, limitsFor, isExpired } = require('./subscription');

const STUDENT_COLUMNS = ['Full Name', 'JAMB Registration Number', 'Email', 'Phone Number', 'Faculty / School', 'Department', 'Programme', 'Entry Level', 'Current Level', 'Admission Year', 'Admission Status'];
const STAFF_COLUMNS = ['Full Name', 'Institution Staff ID', 'Email', 'Phone Number', 'Faculty', 'Department', 'Job Title'];
const clean = (value) => String(value ?? '').trim();
const email = (value) => clean(value).toLowerCase();
const validEmail = (value) => /^\S+@\S+\.\S+$/.test(value);
const key = (value) => clean(value).toLowerCase().replace(/[^a-z0-9]/g, '');
const randomCode = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[crypto.randomInt(32)]).join('');

function valueOf(cell) {
  const value = cell?.value;
  if (value == null) return '';
  if (typeof value === 'object') return clean(value.text || value.result || value.richText?.map((part) => part.text).join('') || '');
  return clean(value);
}

// Some tools (Open XML SDK exports, some online editors) write valid .xlsx files with prefixed tags such as
// <x:workbook>, which the reader does not recognise. Rewrite those parts to the plain form so they load normally.
async function withPlainXmlNamespaces(buffer) {
  const JSZip = require('jszip');
  const zip = await JSZip.loadAsync(buffer);
  let changed = false;
  for (const name of Object.keys(zip.files)) {
    if (zip.files[name].dir || !/^xl\/.*\.xml$/i.test(name)) continue;
    let xml = await zip.file(name).async('string');
    const root = /^(?:﻿)?(?:<\?xml[^>]*\?>\s*)?<([A-Za-z_][\w.-]*):[\w.-]+\b[^>]*?\sxmlns:\1="http:\/\/schemas\.openxmlformats\.org\/spreadsheetml\/2006\/main"/.exec(xml);
    if (!root) continue;
    const prefix = root[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    xml = xml.replace(new RegExp(`<(/?)${prefix}:`, 'g'), '<$1').replace(new RegExp(`xmlns:${prefix}=`, 'g'), 'xmlns=');
    zip.file(name, xml);
    changed = true;
  }
  return changed ? zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }) : buffer;
}

async function spreadsheetRows(filename, base64) {
  const buffer = Buffer.from(clean(base64), 'base64');
  if (!buffer.length || buffer.length > 10 * 1024 * 1024) throw new Error('Select a spreadsheet under 10MB.');
  const workbook = new ExcelJS.Workbook();
  let sheet;
  if (/\.xlsx$/i.test(filename)) {
    try {
      // 1) the main reader, 2) the same after rewriting prefixed tags, 3) a forgiving reader for unusual exports.
      try {
        try { await workbook.xlsx.load(buffer); }
        catch (firstError) { await workbook.xlsx.load(await withPlainXmlNamespaces(buffer)); }
        sheet = workbook.worksheets[0];
        if (!sheet) throw new Error('no worksheet');
      } catch (mainError) {
        sheet = await require('./xlsxFallback').readSheetLoosely(buffer);
      }
    } catch (error) {
      // Record what the file looks like inside (names only, no cell data) so an unusual export can be diagnosed.
      try {
        const zip = await require('jszip').loadAsync(buffer);
        const lines = [`Spreadsheet could not be read (${error.message}).`, `at: ${String(error.stack).split('\n').slice(1, 4).map((line) => line.trim().replace(/\(.*node_modules[\\/]/, '(')).join(' | ')}`, `Entries: ${Object.keys(zip.files).slice(0, 30).join(', ')}`];
        for (const part of ['[Content_Types].xml', '_rels/.rels', 'xl/_rels/workbook.xml.rels', 'xl/workbook.xml', 'xl/worksheets/_rels/sheet1.xml.rels', 'xl/tables/table1.xml', 'xl/worksheets/sheet1.xml', 'xl/sharedStrings.xml']) {
          const entry = zip.file(part);
          if (!entry) continue;
          // Structure only: cut before any cell / string data.
          const text = (await entry.async('string')).split(/<(?:x:)?(?:sheetData|si)[\s>]/)[0].slice(0, 700);
          lines.push(`--- ${part}: ${text}`);
        }
        console.error(lines.join('\n'));
      } catch { console.error(`Spreadsheet could not be read and is not a valid .xlsx zip (${error.message}); ${buffer.length} bytes, first bytes: ${buffer.subarray(0, 8).toString('hex')}`); }
      if (/empty/.test(error.message)) throw error;
      throw new Error('This spreadsheet could not be read. Open it in Excel or Google Sheets, save it as .xlsx (or .csv) again, and re-upload.');
    }
  }
  else if (/\.csv$/i.test(filename)) sheet = await workbook.csv.read(Readable.from([buffer]));
  else throw new Error('Select a .xlsx or .csv spreadsheet.');
  if (!sheet) throw new Error('The spreadsheet is empty.');
  const headers = sheet.getRow(1).values.slice(1).map(key);
  const rows = [];
  sheet.eachRow((row, number) => {
    if (number === 1) return;
    const record = {};
    headers.forEach((header, index) => { if (header) record[header] = valueOf(row.getCell(index + 1)); });
    if (Object.values(record).some(Boolean)) rows.push({ line: number, record });
  });
  if (rows.length > 10000) throw new Error('Import at most 10,000 records per file.');
  return rows;
}

// Reserved / placeholder domains (RFC 2606) that can never receive email.
const undeliverable = (address) => /(^|\.)(example\.(com|org|net)|example|test|invalid|localhost)$/i.test(String(address || '').split('@')[1] || '');
const PLACEHOLDER_EMAIL_MESSAGE = 'This is a placeholder address (example.com) and cannot receive email. Update the contact, then resend.';

function createHandler({ data, save, send, readJson, files }) {
  for (const field of ['students', 'staff', 'imports', 'audit', 'tuition']) data[field] ||= [];
  // Earlier versions marked placeholder addresses as "delivered". Correct that so they can be fixed and resent.
  let corrected = false;
  for (const item of [...data.students, ...data.staff]) {
    if (item.deliveryStatus === 'delivered' && undeliverable(item.email)) { item.deliveryStatus = 'failed'; item.deliveryError = PLACEHOLDER_EMAIL_MESSAGE; delete item.deliveredAt; corrected = true; }
  }
  if (corrected) save();
  const now = () => new Date().toISOString();
  const audit = (user, action, target, detail = '') => data.audit.unshift({ id: crypto.randomUUID(), institutionId: user.id, actor: user.name, action, target, detail, at: now() });
  const notifyStudent = (student, type, title, body) => { data.notifications ||= []; data.notifications.unshift({ id: crypto.randomUUID(), studentId: student.id, type, title, body, read: false, createdAt: now() }); };
  const COMPLETION_DEFAULTS = { idCardMode: 'none', location: '', date: '', hours: '', instructions: '', certificate: true, matric: true, custom: '' };
  // The plan caps how many people an institution can hold (small during the free trial, larger per paid tier).
  const overStudentLimit = (user, adding) => ownStudents(user).length + adding > limitsFor(user).students;
  const overStaffLimit = (user, adding) => ownStaff(user).length + adding > limitsFor(user).staff;
  const planLabel = (user) => (user.plan === 'trial' ? 'free trial' : `${(plans().find((item) => item.id === user.plan) || {}).name || 'current'} plan`);
  const limitMessage = (user, kind) => `Your ${planLabel(user)} allows up to ${limitsFor(user)[kind === 'student' ? 'students' : 'staff']} ${kind === 'student' ? 'students' : 'staff'}. ${user.plan === 'trial' ? 'Subscribe' : 'Upgrade'} to add more.`;
  const ownStudents = (user) => data.students.filter((student) => student.institutionId === user.id);
  const ownStaff = (user) => data.staff.filter((staff) => staff.institutionId === user.id);
  const own = (items, user, id) => items.find((item) => item.id === id && item.institutionId === user.id);
  const prefix = (user) => (user.prefix || user.institutionName.split(/\s+/).map((word) => word[0]).join('').slice(0, 5) || 'INST').toUpperCase();
  function accessId(user, kind) {
    let candidate;
    do { candidate = kind === 'student' ? `${prefix(user)}-${String(new Date().getFullYear()).slice(-2)}-${randomCode()}` : `${prefix(user)}-STF-${randomCode()}`; }
    while ([...data.students, ...data.staff].some((item) => item.clearanceId === candidate || item.accessId === candidate));
    return candidate;
  }
  function currentUser(req) {
    const token = clean(req.headers.authorization).replace(/^Bearer /, '');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const session = data.sessions.find((item) => item.tokenHash === tokenHash && item.expiresAt > Date.now());
    return session && data.users.find((item) => item.id === session.userId && item.role === 'institution');
  }
  function studentInput(input) {
    return {
      name: clean(input.name || input.fullName), jamb: clean(input.jamb || input.jambRegistrationNumber), email: email(input.email),
      phone: clean(input.phone || input.phoneNumber), faculty: clean(input.faculty || input.facultySchool),
      department: clean(input.department), programme: clean(input.programme), entryLevel: clean(input.entryLevel || '100'),
      level: clean(input.level || input.currentLevel || '100'), admissionYear: clean(input.admissionYear),
      admissionStatus: clean(input.admissionStatus || 'Accepted'),
    };
  }
  function staffInput(input) {
    return { name: clean(input.name || input.fullName), staffId: clean(input.staffId || input.institutionStaffId), email: email(input.email), phone: clean(input.phone || input.phoneNumber), faculty: clean(input.faculty), department: clean(input.department), jobTitle: clean(input.jobTitle) };
  }
  function validation(user, kind, record, seen) {
    const issues = [];
    if (!record.name) issues.push('Full name is required');
    if (!validEmail(record.email)) issues.push('Valid email is required');
    if (!record.department) issues.push('Department is required');
    if (kind === 'student') {
      if (!record.jamb) issues.push('JAMB registration number is required');
      if (!record.programme) issues.push('Programme is required');
      if (!/^\d{3}$/.test(record.level)) issues.push('Current level must be 100, 200, 300...');
      if (!/^\d{4}$/.test(record.admissionYear)) issues.push('Admission year is required');
      if (record.jamb && ownStudents(user).some((item) => item.jamb.toLowerCase() === record.jamb.toLowerCase())) issues.push('Duplicate JAMB number');
      if (record.jamb && seen.has(record.jamb.toLowerCase())) issues.push('Duplicate JAMB number in file');
      if (record.jamb) seen.add(record.jamb.toLowerCase());
    } else {
      if (!record.staffId) issues.push('Institution staff ID is required');
      if (record.staffId && ownStaff(user).some((item) => item.staffId.toLowerCase() === record.staffId.toLowerCase())) issues.push('Duplicate staff ID');
      if (record.staffId && seen.has(record.staffId.toLowerCase())) issues.push('Duplicate staff ID in file');
      if (record.staffId) seen.add(record.staffId.toLowerCase());
    }
    if (record.email && [...ownStudents(user), ...ownStaff(user)].some((item) => item.email === record.email)) issues.push('Email already belongs to a person');
    return issues;
  }
  function createPerson(user, kind, record) {
    const common = { id: crypto.randomUUID(), institutionId: user.id, institutionName: user.institutionName, ...record, status: 'pending', approved: false, deliveryStatus: 'pending', disabled: false, createdAt: now() };
    if (kind === 'student') { common.clearanceId = accessId(user, kind); common.matricNo = null; common.session = user.session || '2026/2027'; data.students.push(common); }
    else { common.accessId = accessId(user, kind); common.role = null; common.scope = null; common.assignments = []; data.staff.push(common); }
    audit(user, kind === 'student' ? 'Student added' : 'Staff added', common.name);
    return common;
  }
  const automaticStudentQueue = [];
  const queuedStudentIds = new Set();
  let automaticStudentDeliveryRunning = false;
  function queueStudentEmails(students) {
    for (const student of students) {
      if (!queuedStudentIds.has(student.id)) { queuedStudentIds.add(student.id); automaticStudentQueue.push(student.id); }
    }
    if (!automaticStudentDeliveryRunning && automaticStudentQueue.length) setImmediate(deliverQueuedStudentEmails);
  }
  async function deliverQueuedStudentEmails() {
    if (automaticStudentDeliveryRunning) return;
    automaticStudentDeliveryRunning = true;
    try {
      while (automaticStudentQueue.length) {
        const id = automaticStudentQueue.shift();
        queuedStudentIds.delete(id);
        const student = data.students.find((item) => item.id === id);
        if (!student?.autoDelivery || !['queued', 'sending'].includes(student.deliveryStatus)) continue;
        student.deliveryStatus = 'sending'; save();
        if (undeliverable(student.email)) {
          student.deliveryStatus = 'failed'; student.deliveryError = PLACEHOLDER_EMAIL_MESSAGE; save(); continue;
        }
        if ((!process.env.SMTP_HOST || !process.env.SMTP_FROM) && (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD)) {
          student.deliveryStatus = 'failed'; student.deliveryError = 'Email delivery is not configured. Set up Gmail or SMTP, then resend.'; save(); continue;
        }
        try {
          const info = await sendAccessIdEmail(student.email, student.name, student.clearanceId, 'student', student.institutionName);
          if (info?.rejected?.length) throw new Error('The email provider rejected this address.');
          student.deliveryStatus = 'delivered'; student.deliveredAt = now(); delete student.deliveryError;
        } catch (cause) {
          student.deliveryStatus = 'failed'; student.deliveryError = 'The email could not be sent to this address. Check it and resend.';
          console.error(`Automatic Clearance ID email to ${student.email} failed: ${cause.message}`);
        }
        save();
      }
    } finally {
      automaticStudentDeliveryRunning = false;
      if (automaticStudentQueue.length) setImmediate(deliverQueuedStudentEmails);
    }
  }
  // Resume emails left in progress if the API was restarted during an import.
  setImmediate(() => queueStudentEmails(data.students.filter((item) => item.autoDelivery && ['queued', 'sending'].includes(item.deliveryStatus))));
  async function template(res, kind, format) {
    const columns = kind === 'student' ? STUDENT_COLUMNS : STAFF_COLUMNS;
    if (format === 'csv') {
      res.writeHead(200, { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="${kind}-import-template.csv"`, 'Access-Control-Allow-Origin': '*' });
      return res.end(`${columns.join(',')}\r\n`);
    }
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(kind === 'student' ? 'Students' : 'Staff');
    sheet.addRow(columns);
    sheet.getRow(1).eachCell((cell) => { cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5A17C9' } }; });
    columns.forEach((_, index) => { sheet.getColumn(index + 1).width = 24; });
    const buffer = await workbook.xlsx.writeBuffer();
    res.writeHead(200, { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${kind}-import-template.xlsx"`, 'Access-Control-Allow-Origin': '*' });
    return res.end(Buffer.from(buffer));
  }
  return async function handleInstitution(req, res, route) {
    if (!route.startsWith('/api/institution/')) return false;
    const user = currentUser(req);
    if (!user) { send(res, 401, { error: 'Sign in as an institution administrator.' }); return true; }
    if (user.status !== 'verified') { send(res, 403, { error: 'Choose a plan to activate your institution.', code: 'plan_required' }); return true; }
    // When a trial or subscription ends the workspace is locked, but nothing is deleted: renewing brings it all back.
    if (isExpired(user)) { send(res, 403, { error: 'Your subscription has expired. Your data is safe: renew to continue managing clearance activities.', code: 'subscription_expired' }); return true; }
    if (route === '/api/institution/logo' && req.method === 'GET') {
      const logo = user.attachments?.logo;
      const content = logo && await files.get(logo.fileId);
      if (!content) { send(res, 404, { error: 'No institution logo uploaded.' }); return true; }
      res.writeHead(200, { 'Content-Type': logo.mimeType, 'Cache-Control': 'private, max-age=300' });
      res.end(content); return true;
    }
    if (route === '/api/institution/logo' && req.method === 'PUT') {
      const input = await readJson(req, 3_500_000);
      const mimeType = String(input.mimeType || '');
      if (!['image/png', 'image/jpeg'].includes(mimeType)) { send(res, 400, { error: 'The logo must be a PNG or JPG image.' }); return true; }
      const buffer = Buffer.from(String(input.base64 || ''), 'base64');
      if (!buffer.length) { send(res, 400, { error: 'Choose an image to upload.' }); return true; }
      if (buffer.length > 2 * 1024 * 1024) { send(res, 400, { error: 'The logo must be under 2MB.' }); return true; }
      const fileId = crypto.randomUUID();
      await files.put(fileId, buffer);
      const previous = user.attachments?.logo;
      user.attachments = { ...(user.attachments || {}), logo: { fileId, name: String(input.name || 'logo').slice(0, 120), mimeType, size: buffer.length } };
      if (previous?.fileId && files.remove) await files.remove(previous.fileId).catch(() => {});
      audit(user, 'Institution logo replaced', user.institutionName);
      save();
      send(res, 200, { ok: true, hasLogo: true });
      return true;
    }
    // ---- Digital stamp: added to every document that gets cleared for this institution's students ----
    if (route === '/api/institution/stamp' && req.method === 'GET') {
      send(res, 200, { stamp: user.stamp ? { name: user.stamp.name, mimeType: user.stamp.mimeType, size: user.stamp.size, updatedAt: user.stamp.updatedAt } : null }); return true;
    }
    if (route === '/api/institution/stamp/image' && req.method === 'GET') {
      const content = user.stamp?.fileId && await files.get(user.stamp.fileId);
      if (!content) { send(res, 404, { error: 'No stamp uploaded.' }); return true; }
      res.writeHead(200, { 'Content-Type': user.stamp.mimeType, 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-cache' });
      res.end(content); return true;
    }
    if (route === '/api/institution/stamp' && req.method === 'PUT') {
      try {
        const stamp = await saveStamp({ files, owner: user, input: await readJson(req, 3_000_000), now });
        audit(user, 'Institution stamp uploaded', user.institutionName); save();
        send(res, 200, { stamp: { name: stamp.name, mimeType: stamp.mimeType, size: stamp.size, updatedAt: stamp.updatedAt } });
      } catch (error) { send(res, error.status || 400, { error: error.status ? error.message : 'Request is too large or invalid.' }); }
      return true;
    }
    if (route === '/api/institution/stamp' && req.method === 'DELETE') {
      await removeStamp({ files, owner: user }); audit(user, 'Institution stamp removed', user.institutionName); save();
      send(res, 200, { stamp: null }); return true;
    }
    // ---- Completion actions: what students receive once a clearance is completed ----
    if (route === '/api/institution/completion' && req.method === 'GET') {
      send(res, 200, { completion: { ...COMPLETION_DEFAULTS, ...(user.completion || {}) } }); return true;
    }
    if (route === '/api/institution/completion' && req.method === 'PUT') {
      const input = await readJson(req);
      if (!['none', 'digital', 'physical', 'both'].includes(input.idCardMode)) { send(res, 400, { error: 'Choose how students receive their ID card.' }); return true; }
      user.completion = {
        idCardMode: input.idCardMode, location: clean(input.location), date: clean(input.date), hours: clean(input.hours), instructions: clean(input.instructions),
        certificate: Boolean(input.certificate), matric: Boolean(input.matric), custom: clean(input.custom),
      };
      audit(user, 'Completion actions updated', user.institutionName, user.completion.idCardMode); save();
      send(res, 200, { completion: user.completion }); return true;
    }
    // Per-student ID card (digital delivery) and other official documents.
    const studentFile = route.match(/^\/api\/institution\/students\/([\w-]+)\/(idcard|documents)(?:\/([\w-]+))?$/);
    if (studentFile) {
      const student = own(data.students, user, studentFile[1]);
      if (!student) { send(res, 404, { error: 'Student not found.' }); return true; }
      const [, , part, documentId] = studentFile;
      const readFileInput = async (allowed) => {
        const input = await readJson(req, 8_000_000);
        const mimeType = clean(input.mimeType) || 'application/octet-stream';
        if (allowed && !allowed.includes(mimeType)) throw Object.assign(new Error('The ID card must be a PNG, JPG or PDF file.'), { status: 400 });
        const buffer = Buffer.from(clean(input.base64), 'base64');
        if (!buffer.length) throw Object.assign(new Error('The file is empty.'), { status: 400 });
        if (buffer.length > 5 * 1024 * 1024) throw Object.assign(new Error('The file must be under 5MB.'), { status: 400 });
        const fileId = crypto.randomUUID();
        await files.put(fileId, buffer);
        return { input, fileId, mimeType, size: buffer.length, name: clean(input.name).slice(0, 120) || 'document' };
      };
      try {
        if (part === 'idcard' && req.method === 'GET') {
          const content = student.idCard?.fileId && await files.get(student.idCard.fileId);
          if (!content) { send(res, 404, { error: 'No ID card uploaded.' }); return true; }
          res.writeHead(200, { 'Content-Type': student.idCard.mimeType, 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-cache' }); res.end(content); return true;
        }
        if (part === 'idcard' && req.method === 'PUT') {
          const file = await readFileInput(['image/png', 'image/jpeg', 'application/pdf']);
          if (student.idCard?.fileId) await files.remove?.(student.idCard.fileId).catch(() => {});
          student.idCard = { fileId: file.fileId, mimeType: file.mimeType, name: file.name, size: file.size, uploadedAt: now() };
          notifyStudent(student, 'idcard', 'Your student ID card is ready', 'You can now view and download your student ID card.');
          audit(user, 'Student ID card uploaded', student.name); save(); send(res, 200, { item: student }); return true;
        }
        if (part === 'idcard' && req.method === 'DELETE') {
          if (student.idCard?.fileId) await files.remove?.(student.idCard.fileId).catch(() => {});
          student.idCard = null; audit(user, 'Student ID card removed', student.name); save(); send(res, 200, { item: student }); return true;
        }
        if (part === 'documents' && req.method === 'POST') {
          const file = await readFileInput(null);
          const title = clean(file.input.title);
          if (!title) { send(res, 400, { error: 'Give the document a title.' }); return true; }
          student.officialDocuments = [...(student.officialDocuments || []), { id: crypto.randomUUID(), title: title.slice(0, 120), fileId: file.fileId, mimeType: file.mimeType, name: file.name, size: file.size, uploadedAt: now() }];
          notifyStudent(student, 'document', 'New official document', `${title} is now available in your completion actions.`);
          audit(user, 'Official document uploaded', student.name, title); save(); send(res, 200, { item: student }); return true;
        }
        if (part === 'documents' && documentId && req.method === 'DELETE') {
          const found = (student.officialDocuments || []).find((item) => item.id === documentId);
          if (!found) { send(res, 404, { error: 'Document not found.' }); return true; }
          await files.remove?.(found.fileId).catch(() => {});
          student.officialDocuments = student.officialDocuments.filter((item) => item.id !== documentId);
          audit(user, 'Official document removed', student.name, found.title); save(); send(res, 200, { item: student }); return true;
        }
      } catch (error) { send(res, error.status || 400, { error: error.status ? error.message : 'Request is too large or invalid.' }); return true; }
    }
    const url = new URL(req.url, 'http://localhost');
    const parts = route.split('/').filter(Boolean).slice(2);
    const [area, id, action] = parts;
    const kind = area === 'students' ? 'student' : area === 'staff' ? 'staff' : null;
    const list = kind === 'student' ? data.students : data.staff;

    if (route === '/api/institution/overview' && req.method === 'GET') {
      const students = ownStudents(user), staff = ownStaff(user);
      const submissions = (data.submissions || []).filter((item) => students.some((student) => student.id === item.studentId));
      send(res, 200, { institution: { name: user.institutionName, status: user.status, prefix: prefix(user), session: user.session || '2026/2027' }, stats: { students: students.length, staff: staff.length, officers: staff.filter((item) => item.role === 'officer' && !item.disabled).length, fullyCleared: students.filter((item) => item.status === 'cleared').length, pendingReviews: submissions.filter((item) => ['pending', 'resubmitted'].includes(item.status)).length, actionRequired: submissions.filter((item) => item.status === 'rejected').length }, recent: data.audit.filter((item) => item.institutionId === user.id).slice(0, 5) });
      return true;
    }
    if (kind && !id && req.method === 'GET') {
      const search = clean(url.searchParams.get('search')).toLowerCase();
      const status = clean(url.searchParams.get('status'));
      const people = (kind === 'student' ? ownStudents(user) : ownStaff(user)).filter((item) => (!search || [item.name, item.email, item.department, item.jamb, item.staffId, item.clearanceId, item.accessId].some((v) => clean(v).toLowerCase().includes(search))) && (!status || status === 'all' || item.status === status));
      send(res, 200, { items: people }); return true;
    }
    if (kind && !id && req.method === 'POST') {
      const input = await readJson(req);
      const record = kind === 'student' ? studentInput(input) : staffInput(input);
      const issues = validation(user, kind, record, new Set());
      if (issues.length) { send(res, 400, { error: issues.join('. ') }); return true; }
      if (kind === 'student' && overStudentLimit(user, 1)) { send(res, 402, { error: limitMessage(user, 'student') }); return true; }
      if (kind === 'staff' && overStaffLimit(user, 1)) { send(res, 402, { error: limitMessage(user, 'staff') }); return true; }
      const item = createPerson(user, kind, record); save(); send(res, 201, { item }); return true;
    }
    if (kind && id === 'template' && req.method === 'GET') { await template(res, kind, url.searchParams.get('format') || 'xlsx'); return true; }
    if (kind && id === 'import' && action === 'validate' && req.method === 'POST') {
      const input = await readJson(req, 15_000_000);
      const rows = await spreadsheetRows(input.filename, input.base64);
      const seen = new Set();
      const resultRows = rows.map(({ line, record }) => {
        const normalized = Object.fromEntries(Object.entries(record).map(([k, v]) => [k, v]));
        const person = kind === 'student' ? studentInput({ name: normalized.fullname, jamb: normalized.jambregistrationnumber, email: normalized.email, phone: normalized.phonenumber, faculty: normalized.facultyschool, department: normalized.department, programme: normalized.programme, entryLevel: normalized.entrylevel, level: normalized.currentlevel, admissionYear: normalized.admissionyear, admissionStatus: normalized.admissionstatus }) : staffInput({ name: normalized.fullname, staffId: normalized.institutionstaffid, email: normalized.email, phone: normalized.phonenumber, faculty: normalized.faculty, department: normalized.department, jobTitle: normalized.jobtitle });
        const issues = validation(user, kind, person, seen);
        return { line, person, issues, status: issues.some((issue) => issue.startsWith('Duplicate')) ? 'duplicate' : issues.length ? 'correction' : 'valid' };
      });
      const batch = { id: crypto.randomUUID(), institutionId: user.id, kind, filename: clean(input.filename), rows: resultRows, createdAt: now(), committed: false };
      data.imports.push(batch); save();
      const counts = { detected: resultRows.length, valid: resultRows.filter((row) => row.status === 'valid').length, correction: resultRows.filter((row) => row.status === 'correction').length, duplicates: resultRows.filter((row) => row.status === 'duplicate').length };
      send(res, 200, { batchId: batch.id, counts, issues: resultRows.filter((row) => row.status !== 'valid').slice(0, 200) }); return true;
    }
    if (kind && id === 'import' && action && req.method === 'POST') {
      const batch = data.imports.find((item) => item.id === action && item.institutionId === user.id && item.kind === kind);
      if (!batch || batch.committed) { send(res, 404, { error: 'Import batch not found or already committed.' }); return true; }
      const validRows = batch.rows.filter((row) => row.status === 'valid');
      if (kind === 'student' && overStudentLimit(user, validRows.length)) { send(res, 402, { error: limitMessage(user, 'student') }); return true; }
      if (kind === 'staff' && overStaffLimit(user, validRows.length)) { send(res, 402, { error: limitMessage(user, 'staff') }); return true; }
      const created = validRows.map((row) => createPerson(user, kind, row.person));
      if (kind === 'student') created.forEach((item) => { item.approved = true; item.status = 'ready'; item.autoDelivery = true; item.deliveryStatus = 'queued'; });
      batch.committed = true; batch.committedAt = now(); audit(user, `${kind} import completed`, `${created.length} records`); save();
      send(res, 200, { imported: created.length, items: created, autoDeliveryQueued: kind === 'student' ? created.length : 0 });
      if (kind === 'student') queueStudentEmails(created);
      return true;
    }
    if (kind && id === 'approve' && req.method === 'POST') {
      const input = await readJson(req);
      const selected = (kind === 'student' ? ownStudents(user) : ownStaff(user)).filter((item) => input.all || (Array.isArray(input.ids) && input.ids.includes(item.id)));
      selected.forEach((item) => { item.approved = true; item.status = kind === 'staff' ? 'active' : 'ready'; });
      audit(user, `${kind} access IDs approved`, `${selected.length} records`); save(); send(res, 200, { approved: selected.length }); return true;
    }
    if (kind && id === 'send' && req.method === 'POST') {
      const input = await readJson(req);
      const selected = (kind === 'student' ? ownStudents(user) : ownStaff(user)).filter((item) => item.approved && !['delivered', 'queued', 'sending'].includes(item.deliveryStatus) && (input.all || (Array.isArray(input.ids) && input.ids.includes(item.id))));
      if ((!process.env.SMTP_HOST || !process.env.SMTP_FROM) && (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD)) { send(res, 503, { error: 'Email delivery is not configured. Approved IDs remain pending; configure SMTP to send them.' }); return true; }
      const results = [];
      for (const item of selected.slice(0, 100)) {
        // Placeholder addresses such as name@example.com can never receive mail, so say so instead of "delivering".
        if (undeliverable(item.email)) { item.deliveryStatus = 'failed'; item.deliveryError = PLACEHOLDER_EMAIL_MESSAGE; results.push({ id: item.id, status: 'failed' }); continue; }
        try {
          const info = await sendAccessIdEmail(item.email, item.name, kind === 'student' ? item.clearanceId : item.accessId, kind, user.institutionName);
          if (info?.rejected?.length) throw new Error('The email provider rejected this address.');
          item.deliveryStatus = 'delivered'; item.deliveredAt = now(); delete item.deliveryError; results.push({ id: item.id, status: 'delivered' });
        } catch (cause) { item.deliveryStatus = 'failed'; item.deliveryError = 'The email could not be sent to this address. Check it and resend.'; console.error(`Access ID email to ${item.email} failed: ${cause.message}`); results.push({ id: item.id, status: 'failed' }); }
      }
      audit(user, `${kind} access IDs sent`, `${results.filter((item) => item.status === 'delivered').length} delivered`); save(); send(res, 200, { results, remaining: Math.max(0, selected.length - results.length) }); return true;
    }
    // Sends (or re-sends) one person's ID straight away, even if it was delivered before, and reports the real outcome.
    if (kind && id && action === 'resend' && req.method === 'POST') {
      const item = own(list, user, id);
      if (!item) { send(res, 404, { error: 'Record not found.' }); return true; }
      if (['queued', 'sending'].includes(item.deliveryStatus)) { send(res, 409, { error: 'This Clearance ID email is already being sent. Check its status shortly.' }); return true; }
      if (!item.email) { send(res, 400, { error: 'Add an email address first, then save the contact.' }); return true; }
      if (undeliverable(item.email)) { send(res, 400, { error: PLACEHOLDER_EMAIL_MESSAGE }); return true; }
      if ((!process.env.SMTP_HOST || !process.env.SMTP_FROM) && (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD)) { send(res, 503, { error: 'Email delivery is not configured.' }); return true; }
      try {
        const info = await sendAccessIdEmail(item.email, item.name, kind === 'student' ? item.clearanceId : item.accessId, kind, user.institutionName);
        if (info?.rejected?.length) throw new Error('rejected');
        item.approved = true; item.status = kind === 'staff' ? 'active' : 'ready';
        item.deliveryStatus = 'delivered'; item.deliveredAt = now(); delete item.deliveryError;
        audit(user, `${kind} access ID resent`, item.name); save(); send(res, 200, { item, sentTo: item.email }); return true;
      } catch (cause) {
        item.deliveryStatus = 'failed'; item.deliveryError = 'The email could not be sent to this address. Check it and resend.'; save();
        console.error(`Access ID email to ${item.email} failed: ${cause.message}`);
        send(res, 502, { error: 'The email could not be sent to that address. Check it and try again.' }); return true;
      }
    }
    if (kind && id && req.method === 'GET') {
      const item = own(list, user, id); send(res, item ? 200 : 404, item ? { item } : { error: 'Record not found.' }); return true;
    }
    if (kind && id && req.method === 'PATCH') {
      const item = own(list, user, id);
      if (!item) { send(res, 404, { error: 'Record not found.' }); return true; }
      const input = await readJson(req);
      const fields = kind === 'student' ? ['name', 'email', 'phone', 'faculty', 'department', 'programme', 'entryLevel', 'level', 'admissionYear', 'admissionStatus', 'matricNo', 'tuitionStatus', 'disabled'] : ['name', 'email', 'phone', 'faculty', 'department', 'jobTitle', 'disabled'];
      const matricBefore = item.matricNo;
      const emailBefore = item.email;
      for (const field of fields) if (Object.hasOwn(input, field)) item[field] = field === 'disabled' ? Boolean(input[field]) : clean(input[field]);
      if (item.email) item.email = email(item.email);
      // A changed address means the previous delivery no longer counts; the ID is due to be sent again.
      if (Object.hasOwn(input, 'email') && item.email !== emailBefore && item.deliveryStatus) { item.deliveryStatus = 'pending'; delete item.deliveryError; delete item.deliveredAt; }
      // The matric number is added to the existing student account; the student is told when it is assigned.
      if (kind === 'student' && item.matricNo && item.matricNo !== matricBefore) { notifyStudent(item, 'matric', 'Matric number assigned', `Your matriculation number is ${item.matricNo}.`); audit(user, 'Matric number assigned', item.name, item.matricNo); }
      audit(user, kind === 'student' ? 'Student updated' : 'Staff updated', item.name); save(); send(res, 200, { item }); return true;
    }
    if (area === 'staff' && id && action === 'role' && req.method === 'POST') {
      const staff = own(data.staff, user, id);
      if (!staff || staff.disabled) { send(res, 404, { error: 'Active staff member not found.' }); return true; }
      const input = await readJson(req);
      if (!clean(input.department) || !/^\d{3}$/.test(clean(input.level)) || !/^\d{4}\/\d{4}$/.test(clean(input.session))) { send(res, 400, { error: 'Department, level and session are required for officer scope.' }); return true; }
      staff.role = 'officer';
      staff.scope = { faculty: clean(input.faculty), department: clean(input.department), level: clean(input.level), session: clean(input.session), assignedAt: now(), assignedBy: user.id };
      audit(user, 'Officer scope assigned', staff.name, `${staff.scope.department} / ${staff.scope.level} / ${staff.scope.session}`); save(); send(res, 200, { item: staff }); return true;
    }
    if (area === 'staff' && id && action === 'role' && req.method === 'DELETE') {
      const staff = own(data.staff, user, id);
      if (!staff) { send(res, 404, { error: 'Staff member not found.' }); return true; }
      staff.role = null; staff.scope = null; staff.assignments = []; audit(user, 'Officer authority removed', staff.name); save(); send(res, 200, { item: staff }); return true;
    }
    if (route === '/api/institution/oversight' && req.method === 'GET') {
      const students = ownStudents(user);
      const submissions = (data.submissions || []).filter((item) => students.some((student) => student.id === item.studentId));
      send(res, 200, { pending: submissions.filter((item) => ['pending', 'resubmitted'].includes(item.status)).length, cleared: submissions.filter((item) => item.status === 'cleared').length, rejected: submissions.filter((item) => item.status === 'rejected').length, recent: data.audit.filter((item) => item.institutionId === user.id).slice(0, 60), clearances: (data.clearances || []).filter((item) => item.institutionId === user.id) }); return true;
    }
    if (route === '/api/institution/tuition' && req.method === 'GET') { send(res, 200, { tuition: data.tuition.find((item) => item.institutionId === user.id) || { mode: 'full', total: '', instalments: [] } }); return true; }
    if (route === '/api/institution/tuition' && req.method === 'PUT') {
      const input = await readJson(req);
      if (!['full', 'instalment', 'custom'].includes(input.mode)) { send(res, 400, { error: 'Select a tuition structure.' }); return true; }
      const instalments = Array.isArray(input.instalments) ? input.instalments.map((item) => Number(item)) : [];
      if (input.mode === 'instalment' && (instalments.length < 2 || instalments.reduce((sum, value) => sum + value, 0) !== 100)) { send(res, 400, { error: 'Instalment percentages must total 100%.' }); return true; }
      const tuition = { institutionId: user.id, mode: input.mode, total: clean(input.total), instalments, custom: clean(input.custom), updatedAt: now() };
      data.tuition = data.tuition.filter((item) => item.institutionId !== user.id); data.tuition.push(tuition); audit(user, 'Tuition structure updated', user.institutionName); save(); send(res, 200, { tuition }); return true;
    }
    if (route === '/api/institution/settings' && req.method === 'GET') { send(res, 200, { settings: { institutionName: user.institutionName, prefix: prefix(user), session: user.session || '2026/2027', officialEmail: user.officialEmail, officialPhone: user.officialPhone, website: user.website, country: user.country, state: user.state, city: user.city, address: user.address } }); return true; }
    if (route === '/api/institution/settings' && req.method === 'PUT') {
      const input = await readJson(req);
      const newPrefix = clean(input.prefix).toUpperCase();
      if (!/^[A-Z]{2,6}$/.test(newPrefix)) { send(res, 400, { error: 'Prefix must be 2 to 6 letters.' }); return true; }
      if (!/^\d{4}\/\d{4}$/.test(clean(input.session))) { send(res, 400, { error: 'Session must look like 2026/2027.' }); return true; }
      user.prefix = newPrefix; user.session = clean(input.session); audit(user, 'Institution settings updated', user.institutionName); save(); send(res, 200, { settings: { prefix: user.prefix, session: user.session } }); return true;
    }
    send(res, 404, { error: 'Institution action not found.' }); return true;
  };
}

module.exports = { createHandler };
