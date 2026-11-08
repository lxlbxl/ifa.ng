import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, AsYouType, type CountryCode } from 'libphonenumber-js/min';
import { API_URL } from '@/integrations/api/config';

export interface Country {
  code: CountryCode;
  name: string;
  dial: string; // "234"
  flag: string; // emoji
}

const flagOf = (code: string) =>
  String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));

let cache: Country[] | null = null;

/** Every country libphonenumber knows, named in the visitor's language, Nigeria and the big diaspora markets first. */
export function allCountries(): Country[] {
  if (cache) return cache;
  let names: Intl.DisplayNames | null = null;
  try { names = new Intl.DisplayNames([navigator.language || 'en', 'en'], { type: 'region' }); } catch { names = null; }
  const list = getCountries().map((code) => ({
    code,
    name: names?.of(code) ?? code,
    dial: getCountryCallingCode(code),
    flag: flagOf(code),
  }));
  list.sort((a, b) => a.name.localeCompare(b.name));
  cache = list;
  return list;
}

/** Countries most IFA.ng clients call from; shown on top of the picker. */
export const POPULAR: CountryCode[] = ['NG', 'GB', 'US', 'GH', 'BR', 'CA', 'BJ', 'TT', 'CU', 'ZA'];

/** Live search on name, ISO code or dial code ("nig", "ng", "+234", "234"). */
export function searchCountries(q: string): Country[] {
  const all = allCountries();
  const t = q.trim().toLowerCase().replace(/^\+/, '');
  if (!t) {
    const top = POPULAR.map((c) => all.find((x) => x.code === c)!).filter(Boolean);
    return [...top, ...all.filter((c) => !POPULAR.includes(c.code))];
  }
  const pop = (c: Country) => { const i = POPULAR.indexOf(c.code); return i < 0 ? 99 : i; };
  const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const ft = fold(t);
  const score = (c: Country) => {
    const n = fold(c.name);
    if (/^\d+$/.test(t)) return c.dial === t ? 0 : c.dial.startsWith(t) ? 1 : 99;
    if (c.code.toLowerCase() === ft) return 0;
    if (n.startsWith(ft)) return 1;
    if (n.split(/[\s,()-]+/).some((w) => w.startsWith(ft))) return 2;
    if (n.includes(ft)) return 3;
    return 99;
  };
  return all
    .map((c) => [score(c), c] as const)
    .filter(([s]) => s < 99)
    .sort((a, b) => a[0] - b[0] || pop(a[1]) - pop(b[1]) || a[1].name.localeCompare(b[1].name))
    .map(([, c]) => c);
}

export const countryByCode = (code: string | null | undefined) =>
  allCountries().find((c) => c.code === (code ?? '').toUpperCase());

// Time zone -> country, for when the server can't tell from the IP.
const TZ: Record<string, CountryCode> = {
  'Africa/Lagos': 'NG', 'Africa/Accra': 'GH', 'Africa/Porto-Novo': 'BJ', 'Africa/Lome': 'TG', 'Africa/Abidjan': 'CI',
  'Africa/Johannesburg': 'ZA', 'Africa/Nairobi': 'KE', 'Africa/Cairo': 'EG', 'Africa/Douala': 'CM', 'Africa/Dakar': 'SN',
  'Europe/London': 'GB', 'Europe/Dublin': 'IE', 'Europe/Paris': 'FR', 'Europe/Berlin': 'DE', 'Europe/Amsterdam': 'NL',
  'Europe/Madrid': 'ES', 'Europe/Rome': 'IT', 'Europe/Lisbon': 'PT', 'America/Sao_Paulo': 'BR', 'America/Bahia': 'BR',
  'America/Havana': 'CU', 'America/Port_of_Spain': 'TT', 'America/Toronto': 'CA', 'America/Vancouver': 'CA',
  'America/New_York': 'US', 'America/Chicago': 'US', 'America/Denver': 'US', 'America/Los_Angeles': 'US',
  'America/Phoenix': 'US', 'America/Anchorage': 'US', 'Pacific/Honolulu': 'US', 'America/Mexico_City': 'MX',
  'America/Caracas': 'VE', 'America/Bogota': 'CO', 'America/Argentina/Buenos_Aires': 'AR', 'America/Jamaica': 'JM',
  'America/Puerto_Rico': 'PR', 'America/Santo_Domingo': 'DO', 'Asia/Dubai': 'AE', 'Australia/Sydney': 'AU',
};

function guessFromDevice(): CountryCode | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && TZ[tz]) return TZ[tz];
  } catch { /* ignore */ }
  const region = (navigator.languages ?? [navigator.language]).map((l) => l?.split('-')[1]).find((r) => r && r.length === 2);
  const c = region ? countryByCode(region) : undefined;
  return c?.code ?? null;
}

let detected: Promise<CountryCode> | null = null;

/** Visitor's country: from the IP (our API reads the edge's country header), else the device, else Nigeria. */
export function detectCountry(): Promise<CountryCode> {
  detected ??= (async () => {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2500);
      const r = await fetch(`${API_URL}/v1/geo`, { signal: ctrl.signal, credentials: 'omit' });
      clearTimeout(t);
      const j = (await r.json()) as { country: string | null };
      const c = countryByCode(j.country);
      if (c) return c.code;
    } catch { /* offline or blocked: fall back */ }
    return guessFromDevice() ?? 'NG';
  })();
  return detected;
}

/** Formats as the person types, in their country's style. */
export function formatNational(digits: string, country: CountryCode): string {
  const plain = new AsYouType(country).input(digits);
  if (/\s/.test(plain) || !digits || digits.startsWith('0')) return plain;
  // Many countries (Nigeria, UK) only format with the trunk 0; most people type the number without it here.
  const withTrunk = new AsYouType(country).input('0' + digits);
  return withTrunk.startsWith('0') && /\s/.test(withTrunk) ? withTrunk.slice(1).trimStart() : plain;
}

/** E.164 (+234...) when the number is valid for the country, else null. Drops a typed trunk 0 (0803 -> 803). */
export function toE164(national: string, country: CountryCode): string | null {
  const p = parsePhoneNumberFromString(national, country);
  return p && p.isValid() ? p.number : null;
}

/** "+234 803 123 4567" for showing back to the person. */
export function prettyPhone(e164: string): string {
  return parsePhoneNumberFromString(e164)?.formatInternational() ?? e164;
}
