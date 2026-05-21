import { describe, it, expect, vi } from 'vitest';

vi.mock('../secrets.js', () => ({ getSecret: () => '', loadSecrets: vi.fn() }));

import { computeNextEra } from '../queue.js';
import type { TimelineData } from '../types.js';

function makeEvents(sortYears: number[]): TimelineData['events'] {
  return sortYears.map(y => ({
    date: String(y),
    sortYear: y,
    title: `Event ${y}`,
    summary: '',
    details: '',
    significance: '',
  }));
}

describe('computeNextEra', () => {
  it('computes the next era from sortYear values', () => {
    // WWI: 1914–1918, span=4 → min span 10, next era 1918–1928
    const result = computeNextEra('World War I', makeEvents([1914, 1916, 1918]));
    expect(result?.topic).toBe('World War I');
    expect(result?.startYear).toBe('1918 CE');
    expect(result?.endYear).toBe('1928 CE');
  });

  it('handles BCE sortYears (negative values)', () => {
    // Ancient Greece: -800 to -146, span=654, next: -146 to 508
    const result = computeNextEra('Ancient Greece', makeEvents([-800, -500, -146]));
    expect(result?.startYear).toBe('146 BCE');
    expect(result?.endYear).toBe('508 CE'); // -146 + 654 = 508
  });

  it('uses a minimum span of 10 years', () => {
    const result = computeNextEra('Short', makeEvents([2000, 2002, 2005]));
    expect(result?.startYear).toBe('2005 CE');
    expect(result?.endYear).toBe('2015 CE'); // min span 10
  });

  it('returns null when the next era would exceed 2100', () => {
    expect(computeNextEra('Near Future', makeEvents([2050, 2080, 2095]))).toBeNull();
  });

  it('returns null when there are fewer than 2 sortYear values', () => {
    expect(computeNextEra('Single', makeEvents([1900]))).toBeNull();
    expect(computeNextEra('Empty', makeEvents([]))).toBeNull();
  });

  it('returns null when events have no sortYear fields', () => {
    const events = [{ date: '1914', title: 'T', summary: '', details: '', significance: '' }];
    expect(computeNextEra('No SortYear', events as TimelineData['events'])).toBeNull();
  });

  it('formats year 0 as 1 BCE', () => {
    const result = computeNextEra('Test', makeEvents([-10, 0]));
    expect(result?.startYear).toBe('1 BCE');
  });
});
