import { describe, expect, it } from 'vitest';
import { displayName, nameKey } from './names.ts';

describe('result names', () => {
  it('gives the same key however a site writes the name', () => {
    const k = nameKey('Ford Smith');
    expect(nameKey('Ford SMITH')).toBe(k);
    expect(nameKey('Smith, Ford')).toBe(k);
    expect(nameKey('  ford   smith jr. ')).toBe(k);
    expect(nameKey('Smith, Ford II')).toBe(k);
    expect(nameKey('María Cecilia Chavira')).toBe(nameKey('Chavira, Maria Cecilia'));
    expect(nameKey("O'Neil, Sean")).toBe('neil o sean');
  });

  it('tidies display names', () => {
    expect(displayName('Bennett SPRADLIN')).toBe('Bennett Spradlin');
    expect(displayName('Raider, Dean')).toBe('Dean Raider');
    expect(displayName('Ryan McDonald')).toBe('Ryan McDonald');
  });
});
