import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { readStatus } from '../src/status.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('status board', () => {
  it('shows the lane banner and the nights on disk', async () => {
    process.env.LANE_MARKER = 'TEST-MARKER';
    const res = await createApp(config).request('/');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('TEST-MARKER');
    expect(html).toContain('href="/digest/2026-10-28"');
    expect(html).toContain('href="/digest/2026-10-27"');
    expect(html).toContain('4 ok · 0 retry · 1 fail');
    expect(html.indexOf('2026-10-28')).toBeLessThan(html.indexOf('2026-10-27'));
  });

  it('renders unavailable counts when a night disappears after listing', () => {
    const status = readStatus(config, () => null);

    expect(status.nights.map(({ night }) => night)).toEqual(['2026-10-28', '2026-10-27']);
    expect(status.nights[0]).toMatchObject({
      night: '2026-10-28',
      ok: null,
      retry: null,
      fail: null,
    });
  });

  it('health answers with the lane id', async () => {
    const res = await createApp(config).request('/health');
    expect(await res.json()).toEqual({ ok: true, lane: 'lane-07' });
  });
});
