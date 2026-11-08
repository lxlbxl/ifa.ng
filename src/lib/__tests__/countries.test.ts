import { describe, expect, it } from 'vitest';
import { searchCountries, toE164, formatNational } from '../countries';

describe('country picker search', () => {
  it('finds by name, ISO code and dial code', () => {
    expect(searchCountries('nige')[0].code).toBe('NG');
    expect(searchCountries('gb')[0].code).toBe('GB');
    expect(searchCountries('+234')[0].code).toBe('NG');
    expect(searchCountries('233')[0].code).toBe('GH');
    expect(searchCountries('bra')[0].code).toBe('BR');
  });
  it('puts popular countries first when empty', () => {
    expect(searchCountries('').slice(0, 3).map((c) => c.code)).toEqual(['NG', 'GB', 'US']);
  });
});

describe('phone numbers', () => {
  it('turns a local Nigerian number with a trunk 0 into E.164', () => {
    expect(toE164('08031234567', 'NG')).toBe('+2348031234567');
    expect(toE164('8031234567', 'NG')).toBe('+2348031234567');
    expect(toE164('0803123', 'NG')).toBeNull();
    expect(toE164('07911123456', 'GB')).toBe('+447911123456');
  });
  it('formats as you type', () => {
    expect(formatNational('8031234567', 'NG')).toMatch(/803 123 4567/);
  });
});
