import { describe, expect, it } from 'vitest';
import { SUB_TOUR_CLASSIFIERS } from './sub-tours.ts';

describe('SUB_TOUR_CLASSIFIERS.ntpga', () => {
  const classify = SUB_TOUR_CLASSIFIERS.ntpga;
  it('sorts Medalist and Prep Tour events by prefix', () => {
    expect(classify('Medalist Tour: East 603')).toBe('ntpga-medalist');
    expect(classify('Prep Tour: Metro 517')).toBe('ntpga-prep');
  });
  it('falls back to majors for AAT events and unprefixed majors', () => {
    expect(classify('AAT: Grand Prairie Classic')).toBe('ntpga-majors');
    expect(classify('GG WHOSNEXT Major @ Hawks Creek')).toBe('ntpga-majors');
  });
});

describe('SUB_TOUR_CLASSIFIERS.stpga', () => {
  const classify = SUB_TOUR_CLASSIFIERS.stpga;
  it('sorts by series prefix, with or without a space before the dash', () => {
    expect(classify('Junior Tour - Bentwater Country Club')).toBe('stpga-junior-tour');
    expect(classify('Junior Links - Atascocita Golf Club')).toBe('stpga-junior-links');
    expect(classify('Little Linksters - East River 9')).toBe('stpga-little-linksters');
    expect(classify('Little Linksters- Blackhorse Golf Club')).toBe('stpga-little-linksters');
  });
  it('sorts season championships by their series name', () => {
    expect(classify('Junior Links Fall Championship')).toBe('stpga-junior-links');
    expect(classify('Junior Tour Fall Championship')).toBe('stpga-junior-tour');
    expect(classify('Little Linksters Fall Championship')).toBe('stpga-little-linksters');
  });
  it('falls back to prestige for PT majors, Parent/Junior and standalone events', () => {
    expect(classify('PT - STPGA Challenge')).toBe('stpga-prestige');
    expect(classify('Parent/Junior - Forest Creek Golf Club')).toBe('stpga-prestige');
    expect(classify('15th Texas Junior Cup Matches')).toBe('stpga-prestige');
  });
});

describe('SUB_TOUR_CLASSIFIERS.ajga', () => {
  const classify = SUB_TOUR_CLASSIFIERS.ajga;
  it('sorts qualifiers by their "Qualifier - " prefix', () => {
    expect(classify('Qualifier - Russell Henley Junior Championship presented by Pinnacle Financial Partners')).toBe('ajga-qualifier');
  });
  it('sorts Invitational, Junior All-Star, Preview and Senior events by keyword', () => {
    expect(classify('Ninja Invitational hosted by Janet Xiyu Lin')).toBe('ajga-invitational');
    expect(classify('adidas Junior All-Star')).toBe('ajga-allstar');
    expect(classify('AJGA Preview at Quail Creek presented by City of Robinson')).toBe('ajga-preview');
    expect(classify('Marie Birdie Senior Girls Championship')).toBe('ajga-senior');
  });
  it('prefers Invitational over Junior All-Star when a name has both', () => {
    expect(classify('AJGA Junior All-Star Invitational')).toBe('ajga-invitational');
  });
  it('falls back to open for regular championships', () => {
    expect(classify('Russell Henley Junior Championship presented by Pinnacle Financial Partners')).toBe('ajga-open');
    expect(classify('Randy Wise Junior Open presented by Genesee County')).toBe('ajga-open');
  });
});
