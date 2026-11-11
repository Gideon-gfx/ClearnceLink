const crypto = require('node:crypto');

const DEMO_ACCOUNTS = [
  {
    id: 'clearancelink-demo-institution',
    role: 'institution',
    email: 'demo.institution@clearancelink.app',
    name: 'Demo Administrator',
    status: 'verified',
    institutionId: 'clearancelink-demo-institution',
    institutionName: 'ClearanceLink Demo University',
  },
  {
    id: 'clearancelink-demo-student-user',
    role: 'student',
    email: 'demo.student@clearancelink.app',
    name: 'Demo Student',
    status: 'active',
    studentId: 'clearancelink-demo-student',
  },
  {
    id: 'clearancelink-demo-staff-user',
    role: 'staff',
    email: 'demo.staff@clearancelink.app',
    name: 'Demo Staff',
    status: 'active',
    staffId: 'clearancelink-demo-staff',
  },
];

const INSTITUTION_ID = 'clearancelink-demo-institution';
const STUDENT_ID = 'clearancelink-demo-student';
const STAFF_ID = 'clearancelink-demo-staff';
const CLEARANCE_ID = 'clearancelink-demo-clearance';
const SESSION = '2026/2027';

function upsertDemoRecord(records, id, fields) {
  const record = records.find((item) => item.id === id);
  if (record && !record.isDemo) throw new Error(`Demo account seed conflicts with existing record ${id}.`);
  if (record) Object.assign(record, fields);
  else records.push(fields);
}

async function seedDemoAccounts({ data, save, hashPassword, verifyPassword, password }) {
  if (!password) return false;
  if (!/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password)) {
    throw new Error('DEMO_ACCOUNT_PASSWORD must be at least 8 characters and include an uppercase letter, a number, and a symbol.');
  }

  for (const key of ['users', 'students', 'staff', 'clearances', 'submissions', 'notifications', 'staffNotifications', 'completions', 'audit']) data[key] ||= [];
  for (const account of DEMO_ACCOUNTS) {
    const conflictingUser = data.users.find((item) => item.email === account.email && item.id !== account.id);
    if (conflictingUser) throw new Error(`Demo account email is already used by another account: ${account.email}.`);
  }

  const existingHashes = DEMO_ACCOUNTS
    .map((account) => data.users.find((item) => item.id === account.id)?.passwordHash)
    .filter(Boolean);
  const passwordAlreadySet = existingHashes.length === DEMO_ACCOUNTS.length
    && await Promise.all(existingHashes.map((hash) => verifyPassword(password, hash))).then((results) => results.every(Boolean));

  const passwordHashes = passwordAlreadySet
    ? DEMO_ACCOUNTS.map((account) => data.users.find((item) => item.id === account.id).passwordHash)
    : await Promise.all(DEMO_ACCOUNTS.map(() => hashPassword(password)));

  const institution = {
    id: INSTITUTION_ID,
    role: 'institution',
    email: DEMO_ACCOUNTS[0].email,
    name: DEMO_ACCOUNTS[0].name,
    passwordHash: passwordHashes[0],
    status: 'verified',
    isDemo: true,
    institutionName: 'ClearanceLink Demo University',
    institutionType: 'University',
    country: 'Nigeria',
    state: 'Lagos',
    city: 'Lagos',
    address: 'Demo Campus',
    officialEmail: DEMO_ACCOUNTS[0].email,
    phone: '+2347000000000',
    prefix: 'CLDEMO',
    plan: 'pro',
    subscriptionEndsAt: '2099-12-31T23:59:59.000Z',
    session: SESSION,
    completion: { idCardMode: 'physical', location: 'Student Affairs Office', certificate: true, matric: true },
    createdAt: '2026-01-01T00:00:00.000Z',
  };
  upsertDemoRecord(data.users, INSTITUTION_ID, institution);

  const student = {
    id: STUDENT_ID,
    userId: 'clearancelink-demo-student-user',
    institutionId: INSTITUTION_ID,
    institutionName: institution.institutionName,
    name: 'Demo Student',
    email: DEMO_ACCOUNTS[1].email,
    phone: '+2347000000001',
    jamb: 'DEMO20260001',
    clearanceId: 'CLDEMO-26-000001',
    matricNo: 'CLDEMO/2026/001',
    faculty: 'Science',
    department: 'Computer Science',
    programme: 'B.Sc. Computer Science',
    entryLevel: '100',
    level: '300',
    admissionYear: '2024',
    admissionStatus: 'Accepted',
    status: 'active',
    approved: true,
    disabled: false,
    session: SESSION,
    isDemo: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
  upsertDemoRecord(data.students, STUDENT_ID, student);
  upsertDemoRecord(data.users, 'clearancelink-demo-student-user', {
    id: 'clearancelink-demo-student-user',
    role: 'student',
    email: DEMO_ACCOUNTS[1].email,
    name: DEMO_ACCOUNTS[1].name,
    passwordHash: passwordHashes[1],
    status: 'active',
    studentId: STUDENT_ID,
    isDemo: true,
  });

  const staff = {
    id: STAFF_ID,
    userId: 'clearancelink-demo-staff-user',
    institutionId: INSTITUTION_ID,
    institutionName: institution.institutionName,
    name: 'Demo Staff',
    email: DEMO_ACCOUNTS[2].email,
    phone: '+2347000000002',
    staffId: 'CLDEMO-STAFF-001',
    accessId: 'CLDEMO-STF-000001',
    faculty: 'Science',
    department: 'Computer Science',
    jobTitle: 'Clearance Officer',
    status: 'active',
    disabled: false,
    role: 'officer',
    scope: { faculty: 'Science', department: 'Computer Science', level: '300', session: SESSION },
    assignments: [],
    isDemo: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
  upsertDemoRecord(data.staff, STAFF_ID, staff);
  upsertDemoRecord(data.users, 'clearancelink-demo-staff-user', {
    id: 'clearancelink-demo-staff-user',
    role: 'staff',
    email: DEMO_ACCOUNTS[2].email,
    name: DEMO_ACCOUNTS[2].name,
    passwordHash: passwordHashes[2],
    status: 'active',
    staffId: STAFF_ID,
    isDemo: true,
  });

  upsertDemoRecord(data.clearances, CLEARANCE_ID, {
    id: CLEARANCE_ID,
    institutionId: INSTITUTION_ID,
    createdBy: STAFF_ID,
    name: 'Demo Student Clearance',
    session: SESSION,
    description: 'Sample clearance for the app-store review demo.',
    stages: [{
      id: 'clearancelink-demo-stage',
      name: 'Department',
      requirements: [{
        id: 'clearancelink-demo-requirement',
        name: 'Department Clearance Form',
        hint: 'Sample review requirement',
        kind: 'upload',
        formats: ['PDF', 'JPG', 'PNG'],
        maxMb: 5,
      }],
    }],
    completion: { certificate: true, matric: true },
    isDemo: true,
  });

  for (const account of DEMO_ACCOUNTS) {
    const user = data.users.find((item) => item.id === account.id);
    if (!user || !user.isDemo) throw new Error(`Could not create the ${account.role} demo account.`);
  }
  save();
  return true;
}

function demoSessionUser(data, req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const session = data.sessions.find((item) => item.tokenHash === tokenHash && item.expiresAt > Date.now());
  return session && data.users.find((item) => item.id === session.userId && item.isDemo);
}

function isDemoWriteRequest(data, req) {
  return Boolean(demoSessionUser(data, req) && !['GET', 'HEAD'].includes(req.method));
}

module.exports = { DEMO_ACCOUNTS, seedDemoAccounts, isDemoWriteRequest };
