import { describe, it, expect } from 'vitest';

describe('Year extraction from period strings', () => {
  // Helper function that replicates the Timeline.tsx logic
  const extractYears = (period: string) => {
    const topicParts = period.split(/\s+(?:to|–)\s+/);
    const startYear = topicParts[0]?.trim() || '';
    const endYear = topicParts[1]?.trim() || '';
    return { startYear, endYear };
  };

  it('extracts years from period with " to " separator', () => {
    const { startYear, endYear } = extractYears('800 BCE to 146 BCE');
    expect(startYear).toBe('800 BCE');
    expect(endYear).toBe('146 BCE');
  });

  it('extracts years from period with " – " (en-dash) separator', () => {
    const { startYear, endYear } = extractYears('800 BCE – 146 BCE');
    expect(startYear).toBe('800 BCE');
    expect(endYear).toBe('146 BCE');
  });

  it('extracts years with no notation suffix', () => {
    const { startYear, endYear } = extractYears('1066 to 1087');
    expect(startYear).toBe('1066');
    expect(endYear).toBe('1087');
  });

  it('extracts years with CE notation', () => {
    const { startYear, endYear } = extractYears('2020 CE to 2026 CE');
    expect(startYear).toBe('2020 CE');
    expect(endYear).toBe('2026 CE');
  });

  it('extracts years with mixed notation', () => {
    const { startYear, endYear } = extractYears('1 CE – 476 CE');
    expect(startYear).toBe('1 CE');
    expect(endYear).toBe('476 CE');
  });

  it('handles flexible whitespace around separators', () => {
    const { startYear, endYear } = extractYears('800 BCE   to   146 BCE');
    expect(startYear).toBe('800 BCE');
    expect(endYear).toBe('146 BCE');
  });

  it('returns empty strings if period cannot be split', () => {
    const { startYear, endYear } = extractYears('Invalid Period String');
    expect(startYear).toBe('Invalid Period String');
    expect(endYear).toBe('');
  });

  it('parses correctly for parseInt usage in nextEraPeriod calculation', () => {
    const { startYear, endYear } = extractYears('800 BCE to 146 BCE');
    const s = parseInt(startYear, 10);
    const e = parseInt(endYear, 10);
    expect(s).toBe(800);
    expect(e).toBe(146);
  });

  it('preserves trailing text after year for quiz cache key matching', () => {
    const { startYear, endYear } = extractYears('1492 CE to 1800 CE');
    // Years should NOT be stripped of non-digits
    expect(startYear).toBe('1492 CE');
    expect(endYear).toBe('1800 CE');
    expect(startYear).not.toBe('1492');
    expect(endYear).not.toBe('1800');
  });
});
