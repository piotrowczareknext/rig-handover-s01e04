import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DigestReadResult } from '../src/digest/types.js';

const readNight = vi.hoisted(() =>
  vi.fn<(runsDir: string, night: string) => DigestReadResult | null>(),
);

vi.mock('../src/digest/reader.js', () => ({ readNight }));

import { createApp } from '../src/app.js';

const config = {
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
  runsDir: 'runs',
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('digest JSON API', () => {
  it('returns the reader result without changing row order', async () => {
    const result: DigestReadResult = {
      rows: [
        {
          job: 'zeta',
          owner: null,
          runs: 1,
          retries: 0,
          lastStatus: 'ok',
          lastError: null,
          firstAt: '2026-10-28T08:00:00Z',
          lastAt: '2026-10-28T08:00:00Z',
        },
        {
          job: 'alpha',
          owner: 'Ada',
          runs: 2,
          retries: 1,
          lastStatus: 'retry',
          lastError: null,
          firstAt: '2026-10-28T08:01:00Z',
          lastAt: '2026-10-28T08:02:00Z',
        },
      ],
      malformedLines: 1,
    };
    readNight.mockReturnValue(result);

    const response = await createApp(config).request('/api/digest/2026-10-28');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(result);
    expect(readNight).toHaveBeenCalledWith('runs', '2026-10-28');
  });

  it('returns a JSON 404 when the night file is missing', async () => {
    readNight.mockReturnValue(null);

    const response = await createApp(config).request('/api/digest/2026-10-29');

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({ error: 'Digest not found' });
  });
});
