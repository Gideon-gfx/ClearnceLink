// Calling code -> ISO 3166 country. "+1" is shared by several countries; it resolves to the US flag.
const DIAL_CODES: Record<string, string> = {
  '1': 'US', '7': 'RU', '20': 'EG', '27': 'ZA', '30': 'GR', '31': 'NL', '32': 'BE', '33': 'FR', '34': 'ES', '36': 'HU',
  '39': 'IT', '40': 'RO', '41': 'CH', '43': 'AT', '44': 'GB', '45': 'DK', '46': 'SE', '47': 'NO', '48': 'PL', '49': 'DE',
  '51': 'PE', '52': 'MX', '53': 'CU', '54': 'AR', '55': 'BR', '56': 'CL', '57': 'CO', '58': 'VE', '60': 'MY', '61': 'AU',
  '62': 'ID', '63': 'PH', '64': 'NZ', '65': 'SG', '66': 'TH', '81': 'JP', '82': 'KR', '84': 'VN', '86': 'CN', '90': 'TR',
  '91': 'IN', '92': 'PK', '93': 'AF', '94': 'LK', '95': 'MM', '98': 'IR',
  '211': 'SS', '212': 'MA', '213': 'DZ', '216': 'TN', '218': 'LY', '220': 'GM', '221': 'SN', '222': 'MR', '223': 'ML',
  '224': 'GN', '225': 'CI', '226': 'BF', '227': 'NE', '228': 'TG', '229': 'BJ', '230': 'MU', '231': 'LR', '232': 'SL',
  '233': 'GH', '234': 'NG', '235': 'TD', '236': 'CF', '237': 'CM', '238': 'CV', '239': 'ST', '240': 'GQ', '241': 'GA',
  '242': 'CG', '243': 'CD', '244': 'AO', '245': 'GW', '248': 'SC', '249': 'SD', '250': 'RW', '251': 'ET', '252': 'SO',
  '253': 'DJ', '254': 'KE', '255': 'TZ', '256': 'UG', '257': 'BI', '258': 'MZ', '260': 'ZM', '261': 'MG', '263': 'ZW',
  '264': 'NA', '265': 'MW', '266': 'LS', '267': 'BW', '268': 'SZ',
  '351': 'PT', '352': 'LU', '353': 'IE', '354': 'IS', '355': 'AL', '358': 'FI', '359': 'BG', '370': 'LT', '371': 'LV',
  '372': 'EE', '380': 'UA', '381': 'RS', '385': 'HR', '420': 'CZ', '421': 'SK',
  '502': 'GT', '503': 'SV', '504': 'HN', '505': 'NI', '506': 'CR', '507': 'PA', '591': 'BO', '593': 'EC', '595': 'PY', '598': 'UY',
  '852': 'HK', '880': 'BD', '886': 'TW', '960': 'MV', '961': 'LB', '962': 'JO', '963': 'SY', '964': 'IQ', '965': 'KW',
  '966': 'SA', '967': 'YE', '968': 'OM', '971': 'AE', '972': 'IL', '973': 'BH', '974': 'QA', '977': 'NP', '992': 'TJ',
  '993': 'TM', '994': 'AZ', '995': 'GE', '996': 'KG', '998': 'UZ',
};

const flagEmoji = (iso: string) => String.fromCodePoint(...[...iso].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65));

function matchCode(value: string) {
  const compact = value.replace(/[\s\-().]/g, '');
  const digits = compact.startsWith('+') ? compact.slice(1) : compact.startsWith('00') ? compact.slice(2) : null;
  if (!digits) return null;
  for (let length = Math.min(3, digits.length); length >= 1; length -= 1) {
    const code = digits.slice(0, length);
    if (DIAL_CODES[code]) return { code, iso: DIAL_CODES[code], rest: digits.slice(length) };
  }
  return null;
}

// Calling codes shared by several countries/territories; the first entry is the default.
const SHARED_CODES: Record<string, string[]> = {
  '1': ['US', 'CA', 'JM', 'BS', 'BB', 'TT', 'DO', 'PR', 'BM', 'KY', 'AG', 'GD', 'LC', 'VC', 'KN', 'DM', 'AG', 'GU', 'VI', 'AS'],
  '7': ['RU', 'KZ'],
  '39': ['IT', 'VA'],
  '44': ['GB', 'JE', 'GG', 'IM'],
  '47': ['NO', 'SJ'],
  '61': ['AU', 'CX', 'CC'],
  '212': ['MA', 'EH'],
  '262': ['RE', 'YT'],
  '358': ['FI', 'AX'],
  '590': ['GP', 'BL', 'MF'],
  '599': ['CW', 'BQ'],
};
export type DialCountry = { iso: string; flag: string };

// Every country that uses the calling code ("234" -> [Nigeria], "1" -> [US, Canada, Jamaica, ...]).
export function countriesForCode(code: string): DialCountry[] {
  const isos = SHARED_CODES[code] ? [...new Set(SHARED_CODES[code])] : DIAL_CODES[code] ? [DIAL_CODES[code]] : [];
  return isos.map((iso) => ({ iso, flag: flagEmoji(iso) }));
}

// Flag for a bare calling code such as "234" (no plus sign), or null while it is incomplete/unknown.
export const flagForCode = (code: string): string | null => countriesForCode(code)[0]?.flag ?? null;

// Returns the flag for whatever calling code the user has typed so far (e.g. "+234 ..." -> Nigeria), or null.
export const flagForPhone = (value: string): string | null => {
  const match = matchCode(value);
  return match ? flagEmoji(match.iso) : null;
};

// "+234708394" -> "+234 708394": keeps the calling code visibly separate from the rest of the number.
export function formatPhone(value: string): string {
  const match = matchCode(value);
  if (!match || !value.trim().startsWith('+')) return value;
  return match.rest ? `+${match.code} ${match.rest}` : `+${match.code}`;
}
