import { getDb, now } from '../index';

export interface UsageInfo {
  input: number;
  cached: number;
  output: number;
}

export function logEvent(input: {
  kind: string;
  model?: string | null;
  usage?: UsageInfo | null;
  durationMs?: number;
  ok?: boolean;
  note?: string | null;
}) {
  try {
    getDb()
      .prepare(
        `INSERT INTO events (kind, model, input_tokens, cached_tokens, output_tokens, duration_ms, ok, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.kind,
        input.model ?? null,
        input.usage?.input ?? null,
        input.usage?.cached ?? null,
        input.usage?.output ?? null,
        input.durationMs ?? null,
        input.ok === false ? 0 : 1,
        input.note ?? null,
        now(),
      );
  } catch (err) {
    console.error('[events] failed to log', err);
  }
}

export interface UsageSummary {
  calls: number;
  input: number;
  cached: number;
  output: number;
  failures: number;
}

export function usageSummary(sinceMs: number): UsageSummary {
  const r = getDb()
    .prepare(
      `SELECT COUNT(*) AS calls,
              COALESCE(SUM(input_tokens), 0) AS input,
              COALESCE(SUM(cached_tokens), 0) AS cached,
              COALESCE(SUM(output_tokens), 0) AS output,
              COALESCE(SUM(CASE WHEN ok = 0 THEN 1 ELSE 0 END), 0) AS failures
       FROM events WHERE created_at >= ?`,
    )
    .get(sinceMs) as UsageSummary;
  return r;
}

/** ملخص الاستخدام لآخر N يوم */
export function usageLastDays(days: number): UsageSummary {
  return usageSummary(Date.now() - days * 24 * 60 * 60 * 1000);
}
