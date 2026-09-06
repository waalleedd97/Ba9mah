import { getDb, now } from '../index';

export function getSetting(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string) {
  getDb()
    .prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .run(key, value, now());
}

export function deleteSetting(key: string) {
  getDb().prepare('DELETE FROM settings WHERE key = ?').run(key);
}

export function getSpec(): string {
  return getSetting('spec') ?? '';
}

export function isOnboarded(): boolean {
  return Boolean(getSetting('onboarded_at'));
}
