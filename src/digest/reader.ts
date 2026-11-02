import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, DigestStatus, ReadNight } from './types.js';

type RunEntry = {
  at: string;
  job: string;
  status: DigestStatus;
  owner: string | null;
  error?: string;
};

function isRunEntry(value: unknown): value is RunEntry {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const entry = value as Record<string, unknown>;
  return (
    typeof entry.at === 'string' &&
    entry.at.length > 0 &&
    typeof entry.job === 'string' &&
    entry.job.length > 0 &&
    (entry.status === 'ok' || entry.status === 'retry' || entry.status === 'fail') &&
    'owner' in entry &&
    (typeof entry.owner === 'string' || entry.owner === null) &&
    (!('error' in entry) || typeof entry.error === 'string')
  );
}

export const readNight: ReadNight = (runsDir, night) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) {
    return null;
  }

  let contents: string;

  try {
    contents = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return null;
    }

    throw error;
  }

  const rowsByJob = new Map<string, DigestRow>();
  let malformedLines = 0;
  const lines = contents.split(/\r?\n/);

  if (lines.at(-1) === '') {
    lines.pop();
  }

  for (const line of lines) {
    let value: unknown;

    try {
      value = JSON.parse(line);
    } catch {
      malformedLines += 1;
      continue;
    }

    if (!isRunEntry(value)) {
      malformedLines += 1;
      continue;
    }

    const row = rowsByJob.get(value.job);

    if (row === undefined) {
      rowsByJob.set(value.job, {
        job: value.job,
        owner: value.owner,
        runs: 1,
        retries: value.status === 'retry' ? 1 : 0,
        lastStatus: value.status,
        lastError: value.error ?? null,
        firstAt: value.at,
        lastAt: value.at,
      });
      continue;
    }

    row.owner = value.owner;
    row.runs += 1;
    if (value.status === 'retry') {
      row.retries += 1;
    }
    row.lastStatus = value.status;
    row.lastError = value.error ?? null;
    row.lastAt = value.at;
  }

  const rows = [...rowsByJob.values()].sort((a, b) => a.job.localeCompare(b.job));
  return { rows, malformedLines };
};
