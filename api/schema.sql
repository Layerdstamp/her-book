-- Puppy Record API — D1 schema

CREATE TABLE IF NOT EXISTS records (
  id          TEXT PRIMARY KEY,
  owner_token TEXT NOT NULL,
  view_token  TEXT NOT NULL,
  doc         TEXT NOT NULL,
  updated_at  INTEGER NOT NULL,
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_records_owner ON records (owner_token);
CREATE INDEX IF NOT EXISTS idx_records_view  ON records (view_token);
