CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('uploading','queued','processing','succeeded','failed','deleted','expired')),
  format TEXT NOT NULL CHECK(format IN ('jpeg','png','webp')),
  quality INTEGER NOT NULL,
  width INTEGER,
  input_bytes INTEGER NOT NULL,
  output_bytes INTEGER,
  output_key TEXT,
  output_width INTEGER,
  output_height INTEGER,
  error TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  queue_sent_at INTEGER,
  lease_token TEXT,
  lease_until INTEGER,
  attempts INTEGER NOT NULL DEFAULT 0,
  UNIQUE(owner, idempotency_key)
);
CREATE INDEX jobs_owner_created ON jobs(owner, created_at);
CREATE INDEX jobs_expiry ON jobs(expires_at, state);
CREATE INDEX jobs_outbox ON jobs(state, queue_sent_at);
