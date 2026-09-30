// Institution subscription payments (Paystack). An institution registers unpaid, then either starts a short free trial
// or subscribes to a plan. A plan only takes effect after the server has confirmed the payment, for the exact amount,
// directly with Paystack.
const crypto = require('node:crypto');
const { sendWelcomeEmail } = require('./mailer');
const { quoteFor, formatMoney } = require('./currency');
const { trialSettings, plans, subscriptionDays, expiryOf, isExpired } = require('./subscription');

const PAYSTACK = 'https://api.paystack.co';
// The checkout redirects here when done; the app intercepts this address, so it never has to be a live page.
const CALLBACK_URL = 'https://clearancelink.app/payment/complete';
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

  return async function handle(req, res, route) {
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
        status: user.status, plan: user.plan || null, expiresAt: expiryOf(user), expired: isExpired(user),
      });
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
          if (['failed', 'abandoned', 'reversed'].includes(result.status)) { payment.status = result.status; save(); }
          return send(res, 200, { status: result.status || 'pending' }), true;
        }
        // Only accept it if the amount and currency are exactly what we asked for.
        if (result.amount !== payment.amount || String(result.currency).toUpperCase() !== payment.currency) {
          payment.status = 'mismatch'; save();
          return send(res, 402, { error: 'The amount paid does not match the plan price. Please contact support.' }), true;
        }
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
        save();
        if (firstActivation) welcomeDetails(user, 'paid').then((details) => sendWelcomeEmail('institution', user.email, user.name, user.institutionName, details)).catch((cause) => console.error('Welcome email failed:', cause.message));
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
