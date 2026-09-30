// Prices are defined in US dollars. For each institution they are converted to the currency of its country, using
// live exchange rates (cached), and charged in that currency when Paystack supports it, otherwise in US dollars.
const countryList = require('country-list');

// ISO country code -> currency. Countries not listed here are priced in USD.
const CURRENCY_BY_COUNTRY = {
  NG: 'NGN', GH: 'GHS', KE: 'KES', ZA: 'ZAR', US: 'USD', GB: 'GBP', CA: 'CAD', AU: 'AUD', NZ: 'NZD', IN: 'INR', PK: 'PKR', BD: 'BDT',
  EG: 'EGP', MA: 'MAD', TN: 'TND', DZ: 'DZD', TZ: 'TZS', UG: 'UGX', RW: 'RWF', ET: 'ETB', ZM: 'ZMW', MW: 'MWK', BW: 'BWP', NA: 'NAD',
  MZ: 'MZN', AO: 'AOA', CD: 'CDF', SL: 'SLE', LR: 'LRD', GM: 'GMD', CM: 'XAF', GA: 'XAF', CG: 'XAF', TD: 'XAF', CF: 'XAF', GQ: 'XAF',
  SN: 'XOF', CI: 'XOF', ML: 'XOF', BF: 'XOF', BJ: 'XOF', TG: 'XOF', NE: 'XOF', GW: 'XOF', MU: 'MUR', SC: 'SCR',
  AE: 'AED', SA: 'SAR', QA: 'QAR', KW: 'KWD', BH: 'BHD', OM: 'OMR', JO: 'JOD', IL: 'ILS', TR: 'TRY',
  DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', BE: 'EUR', AT: 'EUR', PT: 'EUR', IE: 'EUR', FI: 'EUR', GR: 'EUR', LU: 'EUR', SK: 'EUR', SI: 'EUR', EE: 'EUR', LV: 'EUR', LT: 'EUR', MT: 'EUR', CY: 'EUR', HR: 'EUR',
  CH: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK', PL: 'PLN', CZ: 'CZK', HU: 'HUF', RO: 'RON', UA: 'UAH', RU: 'RUB',
  CN: 'CNY', JP: 'JPY', KR: 'KRW', SG: 'SGD', MY: 'MYR', TH: 'THB', ID: 'IDR', PH: 'PHP', VN: 'VND', HK: 'HKD', TW: 'TWD', LK: 'LKR', NP: 'NPR',
  BR: 'BRL', MX: 'MXN', AR: 'ARS', CL: 'CLP', CO: 'COP', PE: 'PEN', JM: 'JMD', TT: 'TTD',
};
// Currencies the payment provider can charge in; anything else is charged in USD.
const chargeable = () => new Set(String(process.env.PAYSTACK_CURRENCIES || 'NGN,GHS,KES,ZAR,USD').toUpperCase().split(/[\s,]+/).filter(Boolean));

let cache = null; // { rates, at }
const RATE_TTL = 6 * 60 * 60 * 1000;

async function rates() {
  if (cache && Date.now() - cache.at < RATE_TTL) return cache.rates;
  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(8000) });
    const body = await response.json();
    if (body.result === 'success' && body.rates) { cache = { rates: body.rates, at: Date.now() }; return cache.rates; }
  } catch (error) {
    console.error('Exchange-rate lookup failed:', error.message);
  }
  return cache ? cache.rates : null; // a stale rate is better than none
}

function currencyForCountry(countryName) {
  const code = countryList.getCode(String(countryName || '').trim());
  return CURRENCY_BY_COUNTRY[code] || 'USD';
}

// Rounds a converted price to a tidy amount so people see, and pay, "₦59,800" rather than "₦59,812.43".
function tidy(amount) {
  if (amount >= 10000) return Math.round(amount / 100) * 100;
  if (amount >= 1000) return Math.round(amount / 10) * 10;
  if (amount >= 100) return Math.round(amount);
  return Math.round(amount * 100) / 100;
}

// Everything needed to show and charge prices for one institution.
async function quoteFor(countryName) {
  const wanted = currencyForCountry(countryName);
  const table = wanted === 'USD' ? { USD: 1 } : await rates();
  const rate = table?.[wanted];
  const canCharge = chargeable();
  // Use the local currency when we can both convert to it and charge in it; otherwise stay in dollars.
  if (rate && canCharge.has(wanted)) {
    return { currency: wanted, rate, convert: (usd) => (wanted === 'USD' ? usd : tidy(usd * rate)), local: wanted !== 'USD', displayOnly: null };
  }
  return { currency: 'USD', rate: 1, convert: (usd) => usd, local: false, displayOnly: rate && wanted !== 'USD' ? { currency: wanted, rate, convert: (usd) => tidy(usd * rate) } : null };
}

const SYMBOLS = { NGN: '₦', USD: '$', GBP: '£', EUR: '€', GHS: 'GH₵', KES: 'KSh', ZAR: 'R' };
function formatMoney(amount, currency) {
  const number = Number(amount);
  const text = number.toLocaleString('en-US', { minimumFractionDigits: number % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 });
  return `${SYMBOLS[currency] || `${currency} `}${text}`;
}

module.exports = { quoteFor, currencyForCountry, formatMoney };
