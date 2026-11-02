import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/reader.js';

describe('night reader', () => {
  it('aggregates the fixture and counts its malformed line', () => {
    const result = readNight('runs', '2026-10-28');

    expect(result).not.toBeNull();
    expect(result?.rows).toHaveLength(5);
    expect(result?.malformedLines).toBe(1);
    expect(result?.rows.find(({ job }) => job === 'digest/render')).toMatchObject({
      owner: null,
      runs: 1,
      retries: 0,
      lastStatus: 'ok',
      firstAt: '2026-10-29T05:41:09+01:00',
      lastAt: '2026-10-29T05:41:09+01:00',
    });
    expect(result?.rows.find(({ job }) => job === 'fixtures/refresh')).toMatchObject({
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: null,
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
    expect(result?.rows.find(({ job }) => job === 'notes/backup')).toMatchObject({
      lastStatus: 'fail',
      lastError: 'quota exceeded',
    });
  });

  it('counts valid JSON with an invalid schema as malformed', () => {
    expect(readNight('test/fixtures', 'invalid-schema')).toEqual({
      rows: [],
      malformedLines: 1,
    });
  });

  it('returns null for a missing night', () => {
    expect(readNight('runs', 'missing-night')).toBeNull();
  });

  it('leaves non-missing filesystem errors visible', () => {
    expect(() => readNight('runs', 'invalid\0night')).toThrow();
  });
});
