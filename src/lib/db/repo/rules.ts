import { getDb, now } from '../index';
import type { Rule, RuleKind, RuleSource } from '@/lib/types';
import { normalizeText } from '@/lib/text';

interface RuleRow {
  id: number;
  kind: RuleKind;
  text: string;
  source: RuleSource;
  active: number;
  created_at: number;
}

function rowToRule(r: RuleRow): Rule {
  return { id: r.id, kind: r.kind, text: r.text, source: r.source, active: r.active === 1, createdAt: r.created_at };
}

export function listRules(kind?: RuleKind, onlyActive = true): Rule[] {
  const db = getDb();
  const rows = (
    kind
      ? db.prepare(`SELECT * FROM rules WHERE kind = ? ${onlyActive ? 'AND active = 1' : ''} ORDER BY id ASC`).all(kind)
      : db.prepare(`SELECT * FROM rules ${onlyActive ? 'WHERE active = 1' : ''} ORDER BY kind, id ASC`).all()
  ) as RuleRow[];
  return rows.map(rowToRule);
}

export function ruleTexts(kind: RuleKind): string[] {
  return listRules(kind).map((r) => r.text);
}

export function countRules(kind: RuleKind): number {
  return (getDb().prepare('SELECT COUNT(*) AS c FROM rules WHERE kind = ? AND active = 1').get(kind) as { c: number }).c;
}

/** يضيف قاعدة إن لم توجد مثيلتها (بعد التطبيع). يرجّع القاعدة أو null إذا كانت مكررة */
export function addRule(kind: RuleKind, text: string, source: RuleSource): Rule | null {
  const clean = text.trim();
  if (!clean) return null;
  const norm = normalizeText(clean);
  const existing = listRules(kind, false).find((r) => normalizeText(r.text) === norm);
  if (existing) {
    if (!existing.active) {
      getDb().prepare('UPDATE rules SET active = 1 WHERE id = ?').run(existing.id);
      return { ...existing, active: true };
    }
    return null;
  }
  const res = getDb()
    .prepare('INSERT INTO rules (kind, text, source, active, created_at) VALUES (?, ?, ?, 1, ?)')
    .run(kind, clean, source, now());
  return getRule(Number(res.lastInsertRowid));
}

export function getRule(id: number): Rule | null {
  const row = getDb().prepare('SELECT * FROM rules WHERE id = ?').get(id) as RuleRow | undefined;
  return row ? rowToRule(row) : null;
}

export function updateRule(id: number, patch: { text?: string; active?: boolean }): Rule | null {
  const cur = getRule(id);
  if (!cur) return null;
  getDb()
    .prepare('UPDATE rules SET text = ?, active = ? WHERE id = ?')
    .run(patch.text?.trim() || cur.text, (patch.active ?? cur.active) ? 1 : 0, id);
  return getRule(id);
}

export function deleteRule(id: number) {
  getDb().prepare('DELETE FROM rules WHERE id = ?').run(id);
}

/** يبقي آخر N قاعدة متعلَّمة فعّالة من نوع معيّن كي لا تتضخم القوائم */
export function capLearnedRules(kind: RuleKind, max: number) {
  const rows = getDb()
    .prepare(`SELECT id FROM rules WHERE kind = ? AND source = 'learned' AND active = 1 ORDER BY id DESC`)
    .all(kind) as Array<{ id: number }>;
  const extra = rows.slice(max);
  if (extra.length === 0) return;
  const stmt = getDb().prepare('UPDATE rules SET active = 0 WHERE id = ?');
  for (const r of extra) stmt.run(r.id);
}
