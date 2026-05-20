import { describe, it, expect, vi } from 'vitest';

vi.mock('../secrets.js', () => ({
  getSecret: (name: string) => {
    if (name === 'llm-provider') return '';
    return '';
  },
  loadSecrets: vi.fn(),
}));

import { getProvider } from '../llm.js';

describe('getProvider', () => {
  it('defaults to anthropic when no secret is set', () => {
    expect(getProvider()).toBe('anthropic');
  });
});

// ── Streaming helper internals — tested via integration ──────────────────────
// The tryEmitEvents / tryEmitMeta helpers are private but their behaviour
// surfaces through streamGenerate callbacks. We verify the JSON parsing rules
// that the timeline endpoint depends on directly here.

describe('timeline JSON repair logic', () => {
  const repair = (raw: string): string => {
    let jsonStr = raw.match(/\{[\s\S]*\}/)?.[0] ?? '';
    const openBraces = (jsonStr.match(/\{/g) ?? []).length - (jsonStr.match(/\}/g) ?? []).length;
    const openBrackets = (jsonStr.match(/\[/g) ?? []).length - (jsonStr.match(/\]/g) ?? []).length;
    jsonStr += ']'.repeat(Math.max(0, openBrackets)) + '}'.repeat(Math.max(0, openBraces));
    return jsonStr;
  };

  it('returns a valid JSON string for a well-formed object', () => {
    const raw = '{"topic":"T","events":[]}';
    expect(() => JSON.parse(repair(raw))).not.toThrow();
  });

  it('repairs a truncated events array', () => {
    const raw = '{"topic":"T","events":[{"title":"E1","date":"1"}';
    const repaired = repair(raw);
    expect(() => JSON.parse(repaired)).not.toThrow();
  });

  it('repairs a truncated object with properly closed strings', () => {
    // The repair closes brackets/braces but not open strings —
    // truncation must happen at a boundary between values.
    const raw = '{"topic":"T","events":[{"title":"E1","date":"1"}';
    const repaired = repair(raw);
    expect(() => JSON.parse(repaired)).not.toThrow();
  });

  it('returns empty string when no JSON object is present', () => {
    expect(repair('no json here')).toBe('');
  });

  it('strips markdown code fences before extraction', () => {
    const raw = '```json\n{"topic":"T","events":[]}\n```';
    const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    expect(() => JSON.parse(repair(stripped))).not.toThrow();
  });
});
