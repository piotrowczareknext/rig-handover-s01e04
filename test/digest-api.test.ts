import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DigestReadResult } from '../src/digest/types.js';
import { createApp } from '../src/app.js';

const night = '2026-10-28';

let runsDir = '';

beforeEach(async () => {
  runsDir = await mkdtemp(join(tmpdir(), 'rig-digest-routes-'));
});

afterEach(async () => {
  if (runsDir) {
    await rm(runsDir, { recursive: true, force: true });
    runsDir = '';
  }
});

function request(path: string) {
  return createApp({
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  }).request(path);
}

function jobsInPage(html: string): string[] {
  const body = html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1];
  if (body === undefined) {
    throw new Error('Digest page has no table body');
  }

  return [...body.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(([, row]) => {
    const job = row.match(/<td>([\s\S]*?)<\/td>/)?.[1];
    if (job === undefined) {
      throw new Error('Digest row has no job cell');
    }
    return job;
  });
}

describe('digest routes', () => {
  it('serves the page and JSON with the same sorted jobs', async () => {
    await writeFile(
      join(runsDir, `${night}.jsonl`),
      [
        { at: '2026-10-28T08:00:00Z', job: 'zeta', status: 'ok', owner: 'Ada' },
        { at: '2026-10-28T08:01:00Z', job: 'alpha', status: 'retry', owner: null },
      ]
        .map((entry) => JSON.stringify(entry))
        .join('\n'),
    );

    const page = await request(`/digest/${night}`);
    const api = await request(`/api/digest/${night}`);
    const html = await page.text();
    const result: DigestReadResult = await api.json();

    expect(page.status).toBe(200);
    expect(html).toContain(`<h1>digest · ${night}</h1>`);
    expect(api.status).toBe(200);
    expect(jobsInPage(html)).toEqual(['alpha', 'zeta']);
    expect(result.rows.map(({ job }) => job)).toEqual(jobsInPage(html));
    expect(result.malformedLines).toBe(0);
  });

  it('returns 404 for a valid date with no file', async () => {
    const page = await request(`/digest/${night}`);
    const api = await request(`/api/digest/${night}`);

    expect(page.status).toBe(404);
    expect(api.status).toBe(404);
    expect(api.headers.get('content-type')).toContain('application/json');
    expect(await api.json()).toEqual({ error: 'Digest not found' });
  });

  it('serves an empty file as an empty digest', async () => {
    await writeFile(join(runsDir, `${night}.jsonl`), '');

    const page = await request(`/digest/${night}`);
    const api = await request(`/api/digest/${night}`);

    expect(page.status).toBe(200);
    expect(await page.text()).toContain('nothing ran');
    expect(api.status).toBe(200);
    expect(await api.json()).toEqual({ rows: [], malformedLines: 0 });
  });

  it('serves valid rows when the file contains a malformed line', async () => {
    await writeFile(
      join(runsDir, `${night}.jsonl`),
      [
        '{ malformed json',
        JSON.stringify({
          at: '2026-10-28T08:00:00Z',
          job: 'still-ran',
          status: 'ok',
          owner: 'Ada',
        }),
      ].join('\n'),
    );

    const page = await request(`/digest/${night}`);
    const api = await request(`/api/digest/${night}`);
    const result: DigestReadResult = await api.json();

    expect(page.status).toBe(200);
    expect(jobsInPage(await page.text())).toEqual(['still-ran']);
    expect(api.status).toBe(200);
    expect(result.rows.map(({ job }) => job)).toEqual(['still-ran']);
    expect(result.malformedLines).toBe(1);
  });

  it('returns 404 for non-date input', async () => {
    expect((await request('/digest/not-a-date')).status).toBe(404);
    expect((await request('/api/digest/not-a-date')).status).toBe(404);
  });
});
