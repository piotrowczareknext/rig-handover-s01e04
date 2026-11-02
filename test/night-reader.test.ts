import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/reader.js';

describe('night reader', () => {
  it('aggregates the fixture and counts its malformed line', () => {
    const result = readNight('runs', '2026-10-28');

    expect(result).not.toBeNull();
    expect(result?.rows).toHaveLength(5);
    expect(result?.rows.map(({ job }) => job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
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
    expect(readNight('test/fixtures', '2026-10-29')).toEqual({
      rows: [],
      malformedLines: 1,
    });
  });

  it('returns null for a missing night', () => {
    expect(readNight('runs', '2026-10-30')).toBeNull();
  });

  it('rejects night values that are not dates', () => {
    expect(readNight('runs', '..\\..\\2026-10-28')).toBeNull();
  });

  it('leaves non-missing filesystem errors visible', () => {
    expect(() => readNight('runs\0', '2026-10-28')).toThrow();
  });
});
