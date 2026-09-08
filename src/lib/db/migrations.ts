/**
 * الـ migrations مضمّنة كنصوص (لا ملفات .sql) كي تُحزَّم مع مخرجات standalone.
 * أضف عنصراً جديداً في نهاية المصفوفة ولا تعدّل القديم.
 */
export interface Migration {
  name: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    name: '001_init',
    sql: `
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS rounds (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  topic         TEXT,
  exploratory   INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'rating',
  model         TEXT,
  input_tokens  INTEGER,
  cached_tokens INTEGER,
  output_tokens INTEGER,
  created_at    INTEGER NOT NULL,
  completed_at  INTEGER
);

CREATE TABLE IF NOT EXISTS posts (
  id                 TEXT PRIMARY KEY,
  round_id           INTEGER REFERENCES rounds(id) ON DELETE SET NULL,
  position           INTEGER,
  kind               TEXT NOT NULL,
  content            TEXT NOT NULL,
  original_content   TEXT,
  topic              TEXT NOT NULL DEFAULT '',
  angle              TEXT,
  hook_type          TEXT,
  exploratory        INTEGER NOT NULL DEFAULT 0,
  rating             TEXT,
  rated_at           INTEGER,
  verified           INTEGER NOT NULL DEFAULT 0,
  verification_note  TEXT,
  selected_image_id  TEXT,
  art_direction_json TEXT,
  created_at         INTEGER NOT NULL,
  updated_at         INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_posts_rating ON posts(rating, rated_at);
CREATE INDEX IF NOT EXISTS idx_posts_round  ON posts(round_id, position);

CREATE TABLE IF NOT EXISTS dislike_reasons (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id    TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  reason     TEXT NOT NULL,
  category   TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS rules (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  kind       TEXT NOT NULL,
  text       TEXT NOT NULL,
  source     TEXT NOT NULL,
  active     INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rules_kind ON rules(kind, active);

CREATE TABLE IF NOT EXISTS style_profiles (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  version        INTEGER NOT NULL,
  markdown       TEXT NOT NULL,
  data_json      TEXT NOT NULL,
  liked_count    INTEGER NOT NULL,
  disliked_count INTEGER NOT NULL,
  created_at     INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS images (
  id            TEXT PRIMARY KEY,
  post_id       TEXT REFERENCES posts(id) ON DELETE SET NULL,
  saved_post_id TEXT,
  source        TEXT NOT NULL,
  style_key     TEXT,
  style_label   TEXT,
  prompt        TEXT NOT NULL,
  headline      TEXT,
  file_name     TEXT NOT NULL,
  mime          TEXT NOT NULL,
  bytes         INTEGER NOT NULL,
  selected      INTEGER NOT NULL DEFAULT 0,
  rating        TEXT,
  rated_at      INTEGER,
  created_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_images_post  ON images(post_id);
CREATE INDEX IF NOT EXISTS idx_images_saved ON images(saved_post_id);
CREATE INDEX IF NOT EXISTS idx_images_src   ON images(source, created_at);

CREATE TABLE IF NOT EXISTS image_style_stats (
  style_key TEXT PRIMARY KEY,
  shown     INTEGER NOT NULL DEFAULT 0,
  selected  INTEGER NOT NULL DEFAULT 0,
  liked     INTEGER NOT NULL DEFAULT 0,
  disliked  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS saved_posts (
  id         TEXT PRIMARY KEY,
  post_id    TEXT,
  content    TEXT NOT NULL,
  topic      TEXT NOT NULL DEFAULT '',
  image_id   TEXT REFERENCES images(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  kind          TEXT NOT NULL,
  model         TEXT,
  input_tokens  INTEGER,
  cached_tokens INTEGER,
  output_tokens INTEGER,
  duration_ms   INTEGER,
  ok            INTEGER NOT NULL DEFAULT 1,
  note          TEXT,
  created_at    INTEGER NOT NULL
);
`,
  },
  {
    // ملخص الخبر ومصادره عندما تُكتب الجولة عن خبر (JSON من نوع NewsBrief)
    name: '002_rounds_news',
    sql: `ALTER TABLE rounds ADD COLUMN news_json TEXT;`,
  },
];
