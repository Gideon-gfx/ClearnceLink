// Institution subscription payments (Paystack). An institution registers unpaid, then either starts a short free trial
// or subscribes to a plan. A plan only takes effect after the server has confirmed the payment, for the exact amount,
// directly with Paystack.
const crypto = require('node:crypto');
const { sendWelcomeEmail, sendPaymentEmail } = require('./mailer');
const { quoteFor, formatMoney } = require('./currency');
const { trialSettings, plans, subscriptionDays, expiryOf, isExpired } = require('./subscription');

const PAYSTACK = 'https://api.paystack.co';
// The checkout redirects here when done; the app intercepts this address, so it never has to be a live page.
const CALLBACK_URL = process.env.PAYMENT_CALLBACK_URL || 'https://clearncelink.vercel.app/payment/complete';
const DAY = 24 * 60 * 60 * 1000;
const dateLabel = (value) => new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

// Facts used by the institution welcome email: the trial dates and Starter price in the institution's own currency.
async function welcomeDetails(user, kind) {
  const starter = plans()[0];
  const quote = await quoteFor(user.country);
  const price = formatMoney(quote.convert(starter.price), quote.currency);
  if (kind === 'trial') {
    const trial = trialSettings();
    return { plan: 'trial', days: trial.days, students: trial.students, endsAt: dateLabel(user.trialEndsAt), reminderOn: dateLabel(Date.parse(user.trialEndsAt) - DAY), price };
  }
  const tier = plans().find((item) => item.id === user.plan) || starter;
  return { plan: 'paid', planName: tier.name, students: tier.students, endsAt: dateLabel(user.subscriptionEndsAt), price };
}

const settings = () => ({ secret: String(process.env.PAYSTACK_SECRET_KEY || '').trim() });

async function paystack(secret, path, options = {}) {
  const response = await fetch(`${PAYSTACK}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(20000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.status === false) throw new Error(body.message || 'The payment provider could not be reached.');
  return body.data;
}

function createHandler({ data, save, send, readJson, publicUser }) {
  data.payments ||= [];
  const sha = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
  const institutionFrom = (req) => {
    const token = String(req.headers.authorization || '').replace(/^Bearer /, '');
    const session = data.sessions.find((item) => item.tokenHash === sha(token) && item.expiresAt > Date.now());
    return session && data.users.find((item) => item.id === session.userId && item.role === 'institution');
  };
  const offeredPlans = () => plans().filter((item) => item.price > 0);
  data.audit ||= [];
  const log = (user, action, target) => data.audit.unshift({ id: crypto.randomUUID(), institutionId: user.id, actor: user.name, action, target, detail: '', at: new Date().toISOString() });

  // Emails the outcome of a payment once, however many times it is confirmed (verify, webhook, retries).
  function notifyPayment(payment, user, outcome) {
    if (payment.notified === outcome) return;
    payment.notified = outcome;
    const plan = plans().find((item) => item.id === payment.planId);
    const details = { planName: plan?.name || payment.planId, amount: formatMoney(payment.amount / 100, payment.currency), reference: payment.reference, endsAt: outcome === 'success' && user.subscriptionEndsAt ? dateLabel(user.subscriptionEndsAt) : '' };
    sendPaymentEmail(user.email, user.name, user.institutionName, outcome, details).catch((cause) => console.error('Payment email failed:', cause.message));
  }

  // Turns a confirmed payment into a plan. Shared by the in-app verify call and Paystack's webhook, and safe to run twice.
  function activate(payment, user, result) {
    payment.status = 'success';
    payment.paidAt = result.paid_at || new Date().toISOString();
    const firstActivation = user.status !== 'verified';
    // Renewing early extends the current period instead of losing the days that are left.
    const base = user.plan !== 'trial' && user.subscriptionEndsAt && Date.parse(user.subscriptionEndsAt) > Date.now() ? Date.parse(user.subscriptionEndsAt) : Date.now();
    user.status = 'verified';
    user.plan = payment.planId;
    user.paidAt = payment.paidAt;
    user.verifiedAt = user.verifiedAt || new Date().toISOString();
    user.subscriptionEndsAt = new Date(base + subscriptionDays() * DAY).toISOString();
    log(user, 'Plan payment received', `${(plans().find((item) => item.id === payment.planId) || {}).name || payment.planId} plan`);
    save();
    notifyPayment(payment, user, 'success');
    if (firstActivation) welcomeDetails(user, 'paid').then((details) => sendWelcomeEmail('institution', user.email, user.name, user.institutionName, details)).catch((cause) => console.error('Welcome email failed:', cause.message));
  }

  function activateStudentPayment(payment, result) {
    const student = data.students.find((item) => item.id === payment.studentId);
    if (!student) return;
    payment.status = 'success';
    payment.paidAt = result.paid_at || new Date().toISOString();
    student.activationPaidAt = payment.paidAt;
    student.activationPaymentReference = payment.reference;
    save();
  }

  function studentForPayment(input) {
    const student = data.students.find((item) => item.clearanceId === String(input.clearanceId || '').trim().toUpperCase());
    const activation = student && data.activations.find((item) => item.studentId === student.id && item.tokenHash === sha(input.activationToken) && item.expiresAt > Date.now());
    const institution = student && data.users.find((item) => item.id === student.institutionId && item.role === 'institution');
    return { student, activation, institution };
  }

  async function studentQuote(institution) {
    const nigeria = String(institution.country || '').trim().toLowerCase() === 'nigeria';
    const usd = institution.studentActivationUsd === 2 || !nigeria ? 2 : 1;
    // Student activation uses the agreed fixed Nigerian price, independent of live FX rates.
    if (nigeria) {
      const naira = 1060 * usd;
      return { usd, amount: naira * 100, currency: 'NGN', display: formatMoney(naira, 'NGN') };
    }
    const quote = await quoteFor(institution.country);
    return { usd, amount: Math.round(quote.convert(usd) * 100), currency: quote.currency, display: quote.displayOnly ? formatMoney(quote.displayOnly.convert(usd), quote.displayOnly.currency) : formatMoney(quote.convert(usd), quote.currency) };
  }

  // Paystack calls this itself, so it carries no sign-in. It is trusted only if the signature matches our secret key.
  async function webhook(req, res) {
    const { secret } = settings();
    const chunks = []; let size = 0;
    for await (const chunk of req) { size += chunk.length; if (size > 200_000) return send(res, 413, { error: 'Too large.' }); chunks.push(chunk); }
    const raw = Buffer.concat(chunks);
    const signature = String(req.headers['x-paystack-signature'] || '');
    const expected = crypto.createHmac('sha512', secret || 'unset').update(raw).digest('hex');
    const valid = secret && signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    if (!valid) return send(res, 401, { error: 'Invalid signature.' });
    let event; try { event = JSON.parse(raw.toString('utf8')); } catch { return send(res, 400, { error: 'Invalid body.' }); }
    // Always answer 200 for events we do not act on, otherwise Paystack keeps retrying them.
    if (event.event !== 'charge.success') return send(res, 200, { received: true });
    const result = event.data || {};
    const payment = data.payments.find((item) => item.reference === String(result.reference || ''));
    const user = payment && data.users.find((item) => item.id === payment.institutionId && item.role === 'institution');
    if (!payment || (!user && !payment.studentId) || payment.status === 'success') return send(res, 200, { received: true });
    if (result.status !== 'success' || result.amount !== payment.amount || String(result.currency).toUpperCase() !== payment.currency) {
      payment.status = 'mismatch'; save(); if (user && !payment.studentId) notifyPayment(payment, user, 'failed'); console.error(`Webhook payment ${payment.reference} did not match the expected amount.`);
      return send(res, 200, { received: true });
    }
    if (payment.studentId) activateStudentPayment(payment, result);
    else activate(payment, user, result);
    return send(res, 200, { received: true });
  }

  return async function handle(req, res, route) {
    if (route === '/api/paystack/webhook' && req.method === 'POST') { await webhook(req, res); return true; }
    if (route.startsWith('/api/student-payment/')) {
      const input = req.method === 'POST' ? await readJson(req) : Object.fromEntries(new URL(req.url, 'http://localhost').searchParams);
      const { student, activation, institution } = studentForPayment(input);
      if (!student || !activation) return send(res, 403, { error: 'Your verification expired. Request a new code and try again.' }), true;
      if (institution?.plan !== 'student-pay') return send(res, 403, { error: 'Your institution has not selected student payment.' }), true;
      if (student.userId) return send(res, 409, { error: 'This account is already activated.' }), true;
      if (route === '/api/student-payment/config' && req.method === 'POST') {
        try { const quote = await studentQuote(institution); send(res, 200, { ...quote, charged: formatMoney(quote.amount / 100, quote.currency), paid: Boolean(student.activationPaidAt), configured: Boolean(settings().secret) }); }
        catch (error) { send(res, 503, { error: error.message }); }
        return true;
      }
      if (route === '/api/student-payment/init' && req.method === 'POST') {
        if (student.activationPaidAt) return send(res, 409, { error: 'This activation has already been paid.' }), true;
        const { secret } = settings();
        if (!secret) return send(res, 503, { error: 'Payments are not configured yet.' }), true;
        try {
          const quote = await studentQuote(institution);
          const pending = data.payments.findLast((item) => item.studentId === student.id && item.status === 'pending' && item.authorizationUrl && item.amount === quote.amount && item.currency === quote.currency && Date.now() - Date.parse(item.createdAt) < 30 * 60_000);
          if (pending) return send(res, 200, { authorizationUrl: pending.authorizationUrl, reference: pending.reference, callbackUrl: CALLBACK_URL }), true;
          const reference = `CL-ST-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
          const init = await paystack(secret, '/transaction/initialize', { method: 'POST', body: JSON.stringify({ email: student.email, amount: quote.amount, currency: quote.currency, reference, callback_url: CALLBACK_URL, metadata: { studentId: student.id, institutionId: institution.id, purpose: 'student-activation' } }) });
          data.payments.push({ id: crypto.randomUUID(), studentId: student.id, institutionId: institution.id, reference, authorizationUrl: init.authorization_url, amount: quote.amount, currency: quote.currency, status: 'pending', createdAt: new Date().toISOString() });
          save();
          send(res, 200, { authorizationUrl: init.authorization_url, reference, callbackUrl: CALLBACK_URL });
        } catch (error) { send(res, 502, { error: error.message }); }
        return true;
      }
      if (route === '/api/student-payment/verify' && req.method === 'POST') {
        const payment = data.payments.find((item) => item.studentId === student.id && item.reference === String(input.reference || ''));
        if (!payment) return send(res, 404, { error: 'Payment was not found.' }), true;
        if (payment.status === 'success') return send(res, 200, { status: 'success' }), true;
        try {
          const result = await paystack(settings().secret, `/transaction/verify/${encodeURIComponent(payment.reference)}`);
          if (result.status !== 'success') return send(res, 200, { status: result.status || 'pending' }), true;
          if (result.amount !== payment.amount || String(result.currency).toUpperCase() !== payment.currency) return send(res, 402, { error: 'The payment amount did not match.' }), true;
          activateStudentPayment(payment, result);
          send(res, 200, { status: 'success' });
        } catch (error) { send(res, 502, { error: error.message }); }
        return true;
      }
      return false;
    }
    if (!route.startsWith('/api/institution-payment/')) return false;
    const user = institutionFrom(req);
    if (!user) return send(res, 401, { error: 'Please sign in to continue.' }), true;
    const { secret } = settings();
    const trial = trialSettings();
    const active = user.status === 'verified' && !isExpired(user);

    if (route === '/api/institution-payment/config' && req.method === 'GET') {
      // Prices are set in USD and shown in the currency of the institution's country.
      const quote = await quoteFor(user.country);
      const enterpriseUsd = Number(process.env.ENTERPRISE_PRICE_FROM_USD) || 0;
      send(res, 200, {
        configured: Boolean(secret) && offeredPlans().length > 0, currency: quote.currency, localCurrency: quote.local, approxCurrency: quote.displayOnly?.currency || null, subscriptionDays: subscriptionDays(),
        plans: offeredPlans().map(({ id, name, students, price }) => ({ id, name, students, price: quote.convert(price), priceUsd: price, approx: quote.displayOnly ? quote.displayOnly.convert(price) : null })),
        enterprise: { email: process.env.ENTERPRISE_CONTACT_EMAIL || process.env.GMAIL_USER || '', from: enterpriseUsd ? quote.convert(enterpriseUsd) : 0, fromUsd: enterpriseUsd, approx: quote.displayOnly && enterpriseUsd ? quote.displayOnly.convert(enterpriseUsd) : null },
        trial: { available: trial.days > 0 && !user.trialUsed && !active, days: trial.days, students: trial.students, planId: trial.planId },
        status: user.status, plan: user.plan || null, expiresAt: expiryOf(user), expired: isExpired(user), studentPayAvailable: Boolean(secret) && user.plan !== 'student-pay', studentPayUsd: user.plan || String(user.country || '').trim().toLowerCase() !== 'nigeria' ? 2 : 1,
      });
      return true;
    }

    if (route === '/api/institution-payment/student-pay' && req.method === 'POST') {
      if (user.plan === 'student-pay') return send(res, 200, { status: 'success', plan: 'student-pay', user: publicUser(user) }), true;
      if (!secret) return send(res, 503, { error: 'Student payments are not configured yet.' }), true;
      const previousPlan = user.plan || null;
      const studentActivationUsd = previousPlan || String(user.country || '').trim().toLowerCase() !== 'nigeria' ? 2 : 1;
      try { await studentQuote({ ...user, studentActivationUsd }); } catch (error) { return send(res, 503, { error: error.message }), true; }
      user.status = 'verified';
      user.plan = 'student-pay';
      user.billingMode = 'student';
      user.studentActivationUsd = studentActivationUsd;
      user.previousPlan = previousPlan;
      user.verifiedAt = new Date().toISOString();
      user.subscriptionEndsAt = null;
      user.trialEndsAt = null;
      log(user, previousPlan ? 'Switched to student payments' : 'Student payment selected', `Students pay the $${studentActivationUsd} equivalent when activating their accounts`);
      save();
      send(res, 200, { status: 'success', plan: 'student-pay', user: publicUser(user) });
      return true;
    }

    // Free trial: nearly the full product for a few days, limited by volume.
    if (route === '/api/institution-payment/trial' && req.method === 'POST') {
      if (trial.days <= 0) return send(res, 403, { error: 'A free trial is not available right now.' }), true;
      if (user.trialUsed) return send(res, 409, { error: 'Your free trial has already been used. Please choose a plan.' }), true;
      if (active) return send(res, 409, { error: 'This institution is already active.' }), true;
      user.status = 'verified';
      user.plan = 'trial';
      user.trialUsed = true;
      user.trialEndsAt = new Date(Date.now() + trial.days * DAY).toISOString();
      user.verifiedAt = new Date().toISOString();
      log(user, 'Free trial started', `${trial.days} days`);
      save();
      welcomeDetails(user, 'trial').then((details) => sendWelcomeEmail('institution', user.email, user.name, user.institutionName, details)).catch((cause) => console.error('Welcome email failed:', cause.message));
      send(res, 200, { status: 'success', plan: 'trial', user: publicUser(user) });
      return true;
    }

    if (route === '/api/institution-payment/init' && req.method === 'POST') {
      const input = await readJson(req);
      const plan = offeredPlans().find((item) => item.id === input.planId);
      if (!plan) return send(res, 400, { error: 'Choose a plan to continue.' }), true;
      if (!secret) return send(res, 503, { error: 'Payments are not set up yet. Please contact ClearanceLink support.' }), true;
      const reference = `CL-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      // The price is fixed at this moment (in the institution's currency) and checked again when the payment is verified.
      const quote = await quoteFor(user.country);
      const currency = quote.currency;
      const amount = Math.round(quote.convert(plan.price) * 100); // Paystack works in the smallest unit (kobo / cents)
      try {
        const init = await paystack(secret, '/transaction/initialize', {
          method: 'POST',
          body: JSON.stringify({ email: user.email, amount, currency, reference, callback_url: CALLBACK_URL, metadata: { institutionId: user.id, institutionName: user.institutionName, planId: plan.id } }),
        });
        data.payments.push({ id: crypto.randomUUID(), institutionId: user.id, reference, planId: plan.id, amount, currency, status: 'pending', createdAt: new Date().toISOString() });
        save();
        send(res, 200, { authorizationUrl: init.authorization_url, reference, callbackUrl: CALLBACK_URL });
      } catch (error) {
        console.error('Payment init failed:', error.message);
        send(res, 502, { error: 'We could not start the payment. Please try again.' });
      }
      return true;
    }

    if (route === '/api/institution-payment/verify' && req.method === 'POST') {
      const input = await readJson(req);
      const payment = data.payments.find((item) => item.reference === String(input.reference || '') && item.institutionId === user.id);
      if (!payment) return send(res, 404, { error: 'Payment not found.' }), true;
      if (payment.status === 'success') return send(res, 200, { status: 'success', user: publicUser(user) }), true;
      if (!secret) return send(res, 503, { error: 'Payments are not set up yet.' }), true;
      try {
        const result = await paystack(secret, `/transaction/verify/${encodeURIComponent(payment.reference)}`);
        if (result.status !== 'success') {
          if (['failed', 'abandoned', 'reversed'].includes(result.status)) { payment.status = result.status; save(); notifyPayment(payment, user, 'failed'); }
          return send(res, 200, { status: result.status || 'pending' }), true;
        }
        // Only accept it if the amount and currency are exactly what we asked for.
        if (result.amount !== payment.amount || String(result.currency).toUpperCase() !== payment.currency) {
          payment.status = 'mismatch'; save(); notifyPayment(payment, user, 'failed');
          return send(res, 402, { error: 'The amount paid does not match the plan price. Please contact support.' }), true;
        }
        activate(payment, user, result);
        send(res, 200, { status: 'success', plan: payment.planId, user: publicUser(user) });
      } catch (error) {
        console.error('Payment verify failed:', error.message);
        send(res, 502, { error: 'We could not confirm the payment yet. Please try again in a moment.' });
      }
      return true;
    }
    return false;
  };
}

module.exports = { createHandler };
