const fs = require('node:fs');
const path = require('node:path');
const nodemailer = require('nodemailer');

const LOGO_PATH = path.join(__dirname, 'assets', 'logo-email.png');
const LOGO_CID = 'clearancelink-logo';
const OTP_MINUTES = 5;

let transporter;
function getTransporter() {
  if (process.env.SMTP_HOST && process.env.SMTP_FROM) {
    transporter ||= nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: Number(process.env.SMTP_PORT || 587) === 465, auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined });
    return transporter;
  }
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  transporter ||= nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user, pass: pass.replace(/\s+/g, '') } });
  return transporter;
}

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
// How we address someone: "Gideon" for a plain name, "Mr. Adewale" / "Dr. Johnson" when they have a title.
function firstName(name) {
  const raw = String(name || '').trim();
  const title = /^(Mr|Mrs|Ms|Dr|Prof)\.?\s+/i.exec(raw);
  const parts = raw.replace(/^(Mr|Mrs|Ms|Dr|Prof)\.?\s+/i, '').split(/\s+/).filter(Boolean);
  if (title && parts.length) return `${title[1][0].toUpperCase()}${title[1].slice(1).toLowerCase()}. ${parts[parts.length - 1]}`;
  return parts[0] || 'there';
}

// ---------------------------------------------------------------------------------------------------------------
// Content
// Every email is described as data: { subject, title, preheader, greeting, paragraphs, code, codeCaption, callout,
// sections: [{ title, paragraphs, list, ordered }], closing }. `renderEmail` turns it into the branded HTML + plain text.
// ---------------------------------------------------------------------------------------------------------------

const SECURITY_LINES = [
  'Never share your password or a verification code with anyone. ClearanceLink will never ask for them by email, phone or message.',
  'Sign out when you use a shared or borrowed phone.',
  'If you think someone else has used your account, tell your institution straight away so it can be secured.',
];

// One welcome email per kind of new account.
function welcomeContent(kind, name, institutionName, details = {}) {
  const first = firstName(name);
  if (kind === 'institution') {
    const trial = details.plan === 'trial';
    const steps = [
      'Add your students: one by one, or import every admitted student from a single spreadsheet (Students → Import Students). Each row becomes a student with a secure, randomly generated Clearance ID.',
      'Review the generated Clearance IDs, approve the ones that are ready, and send them. Each student receives only their own ID, by email.',
      'Add or import your staff (Staff → Import Staff). Each person gets a Staff Access ID, and staff have no clearance authority until you give it.',
      'Assign Clearance Officers: pick a staff member and choose the department, level and session they are allowed to manage. Officers create the clearances and requirements within that scope.',
      'Set the finishing touches: upload your institution stamp (More → Digital Stamp), choose what students receive after clearance such as ID card, matric number or certificate (More → Completion Actions), and set your tuition structure.',
    ];
    const intro = trial
      ? [
        `Welcome to ClearanceLink, and thank you for registering ${institutionName}. Your workspace is ready, and we are delighted to have you with us.`,
        `You are on a free ${details.days}-day trial of the Starter plan: up to ${Number(details.students).toLocaleString('en-US')} students, with unlimited staff and every feature included. Your trial runs until ${details.endsAt}. No card was taken, and nothing is charged automatically.`,
      ]
      : [
        `Welcome to ClearanceLink, and thank you for registering ${institutionName}. Your workspace is ready, and we are delighted to have you with us.`,
        `Your ${details.planName} plan is active until ${details.endsAt}, with room for up to ${Number(details.students).toLocaleString('en-US')} students and unlimited staff. Every feature is included.`,
      ];
    const sections = [
      {
        title: 'How ClearanceLink fits together',
        paragraphs: ['ClearanceLink replaces paper clearance queues with one accountable process on your students’ and staff members’ phones. Authority flows in one direction, so it is always clear who can do what:'],
        list: [
          'You, the institution administrator, control people and authority: who your students and staff are, who becomes a Clearance Officer, and exactly what each officer may manage.',
          'Clearance Officers create and run the clearance process inside the scope you give them, and can hand individual requirements to other staff to review.',
          'Reviewers verify only the requirements delegated to them, and clear or reject each one with a clear reason.',
          'Students upload what is asked, follow progress in real time, and are notified the moment something needs their attention.',
        ],
      },
      { title: 'Get started in five steps', list: steps, ordered: true },
      {
        title: 'What your students and staff will experience',
        list: [
          'They receive an email with their personal ID, open the app, choose Student or Staff, enter the ID, and confirm with a one-time code sent to the email you registered for them.',
          'They then create a password and sign in normally. They never need the ID again.',
          'Students see only the clearances assigned to them. Staff see only the work assigned to them.',
        ],
      },
    ];
    if (trial) {
      sections.push({
        title: 'What happens after your trial',
        list: [
          `We will email you one day before it ends, on ${details.reminderOn}.`,
          `To continue, subscribe to Starter for ${details.price} per month, or pick a larger plan if you need more students. Sign in, open the plan screen, and tap Make payment.`,
          `If you do not subscribe, your workspace simply pauses on ${details.endsAt}. Nothing is deleted, and you can subscribe at any time to pick up exactly where you left off.`,
        ],
      });
    }
    sections.push({ title: 'Good to know', list: ['Only you, the institution administrator, control who has authority. Clearance Officers work only inside the scope you give them.', 'Every approval, rejection and change is recorded in your audit history, so you can always see who did what and when.', 'When a staff member is removed or disabled they lose access at once, but the decisions they made stay on record.', 'ClearanceLink never handles tuition payments. Your institution verifies tuition from its own records.'] });
    return {
      subject: trial ? `Welcome to ClearanceLink: your ${details.days}-day Starter trial has started` : `Welcome to ClearanceLink, ${institutionName}`,
      title: 'Your institution is ready',
      preheader: `${institutionName} is set up on ClearanceLink. Here is how to get started.`,
      greeting: `Hi ${first},`,
      paragraphs: intro,
      sections,
      closing: 'If you get stuck at any point, just reply to this email and we will help. We are looking forward to seeing your first clearance completed.',
    };
  }
  if (kind === 'staff') {
    return {
      subject: `Welcome to ClearanceLink, ${first}`,
      title: `Welcome aboard, ${first}`,
      preheader: `Your staff account with ${institutionName} is active. Here is how reviewing works.`,
      greeting: `Hi ${first},`,
      paragraphs: [
        `Welcome to ClearanceLink. Your staff account with ${institutionName} is now active, and you can sign in at any time with your email and password.`,
        'ClearanceLink replaces paper clearance queues with a simple, accountable review process. You see only the work that has been assigned to you, students get an instant answer, and every decision is recorded.',
      ],
      sections: [
        {
          title: 'How your access works',
          list: [
            'Being a staff member does not, on its own, give you clearance authority. Your institution administrator decides which staff become Clearance Officers, and the department, level and session each officer may manage.',
            'Officers create the clearances and requirements inside that scope, and can delegate individual requirements to other staff. If that is you, you will review only the requirements handed to you.',
            'You cannot see students or documents outside your assigned scope, and you cannot create officer roles for anyone else.',
          ],
        },
        {
          title: 'Reviewing a submission',
          ordered: true,
          list: [
            'Open the Students tab and choose a list: Pending, Action Required or Cleared. You can also search by name, Clearance ID or JAMB registration number.',
            'Open a student to see their details and submissions, then tap Review Submission.',
            'Open each document to inspect it. You can zoom in, and download a copy if you need one.',
            'Choose Clear Student to approve, or Reject and pick a reason, then write a short message telling the student exactly what to fix. You choose which documents the rejection applies to.',
            'The student is notified immediately. A rejected document comes back to you when the student re-uploads it, and the earlier version stays on record.',
          ],
        },
        {
          title: 'Set up your digital stamp',
          paragraphs: ['Add your stamp or signature once and it is applied for you from then on.'],
          list: [
            'Open Profile and find Digital stamp / signature, then upload a PNG (a transparent background looks best) or a JPG.',
            'Whenever you clear a document, ClearanceLink creates a stamped PDF copy showing your stamp, your institution’s stamp, your name and the date. The student’s original upload is never altered.',
            'Students can download or print the stamped copy from their own app.',
          ],
        },
        {
          title: 'Good review practice',
          list: [
            'Check that the name and details on the document match the student.',
            'Look at the whole document, not just the first page.',
            'When you reject, be specific. A clear message means the student gets it right the first time.',
            'Review promptly. Students are waiting on you to move forward.',
            'Every decision is saved to the audit history with your name, the time and the document, so review carefully.',
          ],
        },
        { title: 'Keeping your account safe', list: SECURITY_LINES },
      ],
      closing: 'If you cannot see any students or requirements yet, your institution may still be finishing your setup. Please contact your institution administrator, who can update your role and scope.',
    };
  }
  return {
    subject: `Welcome to ClearanceLink, ${first}`,
    title: `Welcome, ${first}`,
    preheader: `Your student account with ${institutionName} is active. Here is how to complete your clearance.`,
    greeting: `Hi ${first},`,
    paragraphs: [
      `Welcome to ClearanceLink. Your student account with ${institutionName} is now active, and everything you need to complete your clearance is in one place on your phone.`,
      'No more queues, paper forms or repeated trips between offices. You submit each requirement once, follow its progress in real time, and are notified the moment something needs your attention. You sign in with your email and password, and you will never need your Clearance ID again.',
    ],
    sections: [
      {
        title: 'Your first few minutes',
        ordered: true,
        list: [
          'Open the Clearances tab and choose the clearance assigned to you. Read its description and the list of requirements; each one is set by your institution.',
          'Tap a requirement and choose the file to upload: a PDF, JPG or PNG. The size limit is shown on each requirement.',
          'Check the preview, then tap Upload Document. Your file goes straight to the person responsible for reviewing that requirement.',
          'Watch the status change. You will get a notification when a reviewer clears a document or needs you to fix something.',
        ],
      },
      {
        title: 'What each status means',
        list: [
          'Not Started: you have not uploaded anything for this requirement yet.',
          'Pending Review: your document is with the reviewer. Nothing more is needed from you.',
          'Action Required: a document was rejected. Open it to read the reason and the reviewer’s message.',
          'Re-submitted: your replacement is back with the reviewer.',
          'Cleared: the requirement is approved.',
          'Completed: every requirement in the clearance has been approved.',
        ],
      },
      {
        title: 'If a document is rejected',
        list: [
          'Open the requirement to see the reason (for example unreadable, wrong document, incomplete, or information that does not match) and the reviewer’s message.',
          'Upload a corrected version. You only redo the rejected document, not the whole clearance.',
          'Your earlier version is kept in your history, and the reviewer sees the new one straight away.',
        ],
      },
      {
        title: 'When your clearance is complete',
        paragraphs: ['What happens next is decided by your institution. Depending on how it is set up, you may see:'],
        list: [
          'Your student ID card, either to view, download and print, or with the place and time to collect it.',
          'Your matriculation number, added to this same account once your institution issues it.',
          'Your clearance certificate, and any other official documents your institution shares.',
          'Stamped copies of the documents that were cleared, which you can download or print.',
        ],
      },
      {
        title: 'Tips for a smooth clearance',
        list: [
          'Scan or photograph documents in good light, flat, with all four edges and every line of text visible.',
          'Upload the right document for each requirement, and check the deadline set by your institution.',
          'Keep notifications switched on so you can act quickly if something is rejected.',
          'Use the phone number and email your institution has on record for you, so codes and messages reach you.',
        ],
      },
      { title: 'Keeping your account safe', list: SECURITY_LINES },
    ],
    closing: 'If something does not look right, or you cannot see a clearance you expect, please contact your institution’s clearance office. We wish you a smooth and successful clearance!',
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------------------------------------------

const C = { purple: '#5a17c9', deep: '#1c0a38', ink: '#171548', body: '#3f3d66', muted: '#6e6b91', line: '#e8e4f7', pale: '#f6f2ff', page: '#f1eff9' };
const FONT = "'Segoe UI', Helvetica, Arial, sans-serif";

function renderSection(section) {
  const tag = section.ordered ? 'steps' : 'list';
  const heading = `<tr><td style="padding:26px 0 8px"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="4" style="background:${C.purple};border-radius:2px"></td><td style="padding-left:12px;font:700 17px/1.3 ${FONT};color:${C.ink}">${escapeHtml(section.title)}</td></tr></table></td></tr>`;
  const paragraphs = (section.paragraphs || []).map((paragraph) => `<tr><td style="padding:2px 0 8px;font:400 15px/1.7 ${FONT};color:${C.body}">${escapeHtml(paragraph)}</td></tr>`).join('');
  const rows = (section.list || []).map((item, index) => {
    const marker = tag === 'steps'
      ? `<div style="width:26px;height:26px;line-height:26px;border-radius:13px;background:${C.purple};color:#ffffff;text-align:center;font:700 13px/26px ${FONT}">${index + 1}</div>`
      : `<div style="width:22px;height:22px;line-height:22px;border-radius:11px;background:${C.pale};color:${C.purple};text-align:center;font:700 13px/22px ${FONT}">&#10003;</div>`;
    return `<tr><td width="40" valign="top" style="padding:6px 0">${marker}</td><td valign="top" style="padding:6px 0 6px 4px;font:400 15px/1.65 ${FONT};color:${C.body}">${escapeHtml(item)}</td></tr>`;
  }).join('');
  return heading + paragraphs + (rows ? `<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr>` : '');
}

function renderEmail(content, options = {}) {
  const sections = content.sections || [];
  const paragraphs = content.paragraphs || [];
  const text = [
    content.greeting, '',
    ...paragraphs.flatMap((paragraph) => [paragraph, '']),
    ...(content.code ? [`${content.codeCaption || 'Your code'}: ${content.code}`, ''] : []),
    ...(content.callout ? [content.callout, ''] : []),
    ...sections.flatMap((section) => [section.title.toUpperCase(), ...(section.paragraphs || []), ...(section.list || []).map((item, index) => (section.ordered ? `  ${index + 1}. ${item}` : `  - ${item}`)), '']),
    content.closing, '', 'Warm regards,', 'The ClearanceLink team', 'ClearanceLink | Your Institution. One Platform.',
  ].filter((line) => line !== undefined && line !== null).join('\n');

  const codeBlock = content.code
    ? `<tr><td align="center" style="padding:10px 0 6px"><table role="presentation" cellpadding="0" cellspacing="0" style="background:${C.pale};border:1px solid #dccffb;border-radius:14px"><tr><td align="center" style="padding:20px 34px">`
      + `<div style="font:600 12px/1 ${FONT};letter-spacing:1.6px;text-transform:uppercase;color:${C.muted};margin-bottom:12px">${escapeHtml(content.codeCaption || 'Your code')}</div>`
      + `<div style="font:700 ${content.code.length > 8 ? 26 : 38}px/1.1 'Courier New', Consolas, monospace;letter-spacing:${content.code.length > 8 ? 3 : 10}px;color:#2a1265;padding-left:${content.code.length > 8 ? 3 : 10}px">${escapeHtml(content.code)}</div>`
      + `</td></tr></table></td></tr>`
    : '';
  const calloutBlock = content.callout
    ? `<tr><td style="padding:16px 0 4px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff8e8;border-left:4px solid #f6a500;border-radius:8px"><tr><td style="padding:14px 16px;font:400 14px/1.6 ${FONT};color:#5b4200">${escapeHtml(content.callout)}</td></tr></table></td></tr>`
    : '';

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(content.subject)}</title></head>`
    + `<body style="margin:0;padding:0;background:${C.page};-webkit-text-size-adjust:100%">`
    + `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(content.preheader || '')}${'&nbsp;&zwnj;'.repeat(40)}</div>`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page}"><tr><td align="center" style="padding:28px 12px">`
    + `<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px">`
    // header with logo
    + `<tr><td align="center" style="background:#ffffff;border-radius:20px 20px 0 0;border-top:6px solid ${C.purple};padding:30px 24px 4px"><img src="cid:${LOGO_CID}" width="150" height="150" alt="ClearanceLink" style="display:block;border:0;outline:none;width:150px;height:150px"></td></tr>`
    // body
    + `<tr><td style="background:#ffffff;padding:6px 40px 34px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">`
    + (content.title ? `<tr><td align="center" style="padding:6px 0 22px;font:800 26px/1.25 ${FONT};color:${C.ink}">${escapeHtml(content.title)}</td></tr>` : '')
    + `<tr><td style="padding:0 0 10px;font:600 16px/1.5 ${FONT};color:${C.ink}">${escapeHtml(content.greeting)}</td></tr>`
    + paragraphs.map((paragraph) => `<tr><td style="padding:0 0 12px;font:400 15px/1.75 ${FONT};color:${C.body}">${escapeHtml(paragraph)}</td></tr>`).join('')
    + codeBlock + calloutBlock
    + sections.map(renderSection).join('')
    + (content.closing ? `<tr><td style="padding:26px 0 4px;font:400 15px/1.75 ${FONT};color:${C.body}">${escapeHtml(content.closing)}</td></tr>` : '')
    + `<tr><td style="padding:18px 0 0;font:400 15px/1.7 ${FONT};color:${C.body}">Warm regards,<br><strong style="color:${C.ink}">The ClearanceLink team</strong></td></tr>`
    + `</table></td></tr>`
    // footer
    + `<tr><td align="center" style="background:${C.deep};border-radius:0 0 20px 20px;padding:24px 30px">`
    + `<div style="font:700 14px/1.4 ${FONT};color:#ffffff">ClearanceLink</div>`
    + `<div style="font:400 12px/1.6 ${FONT};color:#c9bdea;margin-top:2px">Your Institution. One Platform.</div>`
    + `<div style="font:400 11px/1.7 ${FONT};color:#a898d3;margin-top:14px">${options.to ? `This message was sent to ${escapeHtml(options.to)}. ` : ''}It was sent automatically, so please do not reply with sensitive information.<br>ClearanceLink will never ask you for your password or a verification code.</div>`
    + `</td></tr>`
    + `</table></td></tr></table></body></html>`;
  return { text, html };
}

async function deliver(to, content) {
  const mail = getTransporter();
  if (!mail) throw new Error('Email delivery is not configured.');
  const { text, html } = renderEmail(content, { to });
  const attachments = fs.existsSync(LOGO_PATH) ? [{ filename: 'clearancelink-logo.png', path: LOGO_PATH, cid: LOGO_CID, contentDisposition: 'inline' }] : [];
  await mail.sendMail({ from: process.env.SMTP_FROM || `"ClearanceLink" <${process.env.GMAIL_USER}>`, to, subject: content.subject, text, html, attachments });
}

// ---------------------------------------------------------------------------------------------------------------
// Emails
// ---------------------------------------------------------------------------------------------------------------

// The institution emails each student/staff member their personal ID so they can activate their account.
async function sendAccessIdEmail(to, name, code, kind, institutionName) {
  const student = kind === 'student';
  const label = student ? 'Clearance ID' : 'Staff Access ID';
  await deliver(to, {
    subject: `${institutionName}: your ${label}`,
    title: `Your ${label}`,
    preheader: `${institutionName} has set you up on ClearanceLink. Your ${label} is inside.`,
    greeting: `Hello ${firstName(name)},`,
    paragraphs: [
      `${institutionName} has registered you on ClearanceLink${student ? ', the app used to complete your clearance' : ', the app used to review student clearance submissions'}. Use the ID below to activate your account.`,
    ],
    code,
    codeCaption: label,
    callout: `Keep this ID private. It is personal to you and is only used once, to activate your account.`,
    sections: [{
      title: 'How to activate your account',
      ordered: true,
      list: [
        'Download and open the ClearanceLink app.',
        `On the welcome screen, tap ${student ? 'Student' : 'Staff'}, then tap ${student ? 'Create student account' : 'Create staff account'}.`,
        `Enter your ${label} exactly as shown above.`,
        'We will send a 6-digit verification code to this email address. Enter it to confirm it is you.',
        'Create a password. From then on you sign in with this email and your password.',
      ],
    }],
    closing: `If you were not expecting this email, or the ID does not work, please contact ${institutionName}.`,
  });
}

// One-time verification code (account activation, institution registration).
async function sendOtpEmail(to, name, code, purpose = 'activate your ClearanceLink account') {
  await deliver(to, {
    subject: `Your ClearanceLink verification code: ${code}`,
    title: 'Verify your identity',
    preheader: `Your ClearanceLink verification code is ${code}. It expires in ${OTP_MINUTES} minutes.`,
    greeting: `Hi ${firstName(name)},`,
    paragraphs: [`Please use the code below to ${purpose}. For your security it is valid for ${OTP_MINUTES} minutes and can only be used once.`],
    code,
    codeCaption: 'Verification code',
    callout: 'Never share this code with anyone. ClearanceLink will never ask for it by phone, message or email. If you did not request it, you can safely ignore this email; nothing has changed on your account.',
    sections: [],
    closing: '',
  });
}

// `details` (institutions only): { plan: 'trial' | 'paid', days, students, endsAt, reminderOn, price, planName }
async function sendWelcomeEmail(kind, to, name, institutionName, details) {
  await deliver(to, welcomeContent(kind, name, institutionName, details));
}

// Sent once, a day before a free trial ends, to institutions that have not subscribed.
async function sendTrialReminderEmail(to, name, institutionName, details) {
  await deliver(to, {
    subject: `Your ClearanceLink trial ends tomorrow (${details.endsAt})`,
    title: 'Your free trial ends tomorrow',
    preheader: `${institutionName}: your data is safe. Subscribe to keep going without a break.`,
    greeting: `Hi ${firstName(name)},`,
    paragraphs: [
      `Your free Starter trial for ${institutionName} ends tomorrow, ${details.endsAt}.`,
      `So far you have ${Number(details.students).toLocaleString('en-US')} student${details.students === 1 ? '' : 's'} and ${Number(details.staff).toLocaleString('en-US')} staff member${details.staff === 1 ? '' : 's'} in your workspace, and all of it is safe.`,
    ],
    sections: [
      { title: 'To keep going without a break', list: [`Sign in to ClearanceLink and open the plan screen.`, `Choose Starter at ${details.price} per month, or a larger plan if you need more students.`, 'Tap Make payment. Your workspace carries on straight away.'], ordered: true },
      { title: 'If you do nothing', list: ['You are not charged. Nothing is taken automatically.', `Your workspace pauses on ${details.endsAt}, and students and staff cannot use it until you subscribe.`, 'Nothing is deleted. Subscribe whenever you are ready and everything is exactly as you left it.'] },
    ],
    closing: 'Questions about plans or pricing? Reply to this email and we will help.',
  });
}

module.exports = { sendOtpEmail, sendAccessIdEmail, sendWelcomeEmail, sendTrialReminderEmail, welcomeContent, renderEmail };
