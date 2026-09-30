// Institution plans: a short free trial (volume-limited), then a paid subscription tiered by student count.
// Prices come from the environment so they can be changed without touching code.
const num = (value, fallback) => (Number.isFinite(Number(value)) && String(value ?? '').trim() !== '' ? Number(value) : fallback);

// The free trial is the Starter plan for a few days, so it has Starter's limits (staff are never capped).
function trialSettings() {
  return { days: Math.max(0, Math.floor(num(process.env.TRIAL_DAYS, 7))), students: plans()[0].students, planId: 'starter' };
}

// Plans that have a price configured are offered; Enterprise is "contact us".
function plans() {
  return [
    { id: 'starter', name: 'Starter', students: 500, price: num(process.env.PLAN_STARTER_PRICE_USD, 0) },
    { id: 'standard', name: 'Standard', students: 2500, price: num(process.env.PLAN_STANDARD_PRICE_USD, 0) },
    { id: 'pro', name: 'Pro', students: 10000, price: num(process.env.PLAN_PRO_PRICE_USD, 0) },
  ];
}

const subscriptionDays = () => Math.max(1, Math.floor(num(process.env.SUBSCRIPTION_DAYS, 365)));

// When the current trial / subscription ends (ISO string), or null if none.
const expiryOf = (user) => (user.plan === 'trial' ? user.trialEndsAt : user.subscriptionEndsAt) || null;
const isExpired = (user) => user.status === 'verified' && Boolean(expiryOf(user)) && Date.parse(expiryOf(user)) < Date.now();

// How many students / staff the institution may hold on its current plan.
function limitsFor(user) {
  if (user.plan === 'trial') return { students: trialSettings().students, staff: Infinity };
  const tier = plans().find((item) => item.id === user.plan);
  return { students: tier ? tier.students : Infinity, staff: Infinity };
}

module.exports = { trialSettings, plans, subscriptionDays, expiryOf, isExpired, limitsFor };
