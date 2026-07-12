CREATE TABLE IF NOT EXISTS licenses (
  id SERIAL PRIMARY KEY,
  key_hash TEXT NOT NULL UNIQUE,
  key_display TEXT NOT NULL,
  email TEXT NOT NULL,
  plan TEXT NOT NULL,
  stripe_session_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  machine_id TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_licenses_email ON licenses(email);
