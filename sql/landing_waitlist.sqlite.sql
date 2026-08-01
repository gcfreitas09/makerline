-- Landing tracker / pre-cadastros
-- Banco local duravel usado pelo waitlist_store.php

CREATE TABLE IF NOT EXISTS landing_waitlist_entries (
  id TEXT PRIMARY KEY,
  name TEXT,
  phone TEXT,
  whatsapp TEXT,
  instagram_handle TEXT,
  phone_digits TEXT,
  email TEXT,
  lead_status TEXT NOT NULL DEFAULT 'new',
  is_test INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_waitlist_name
  ON landing_waitlist_entries (name);

CREATE INDEX IF NOT EXISTS idx_waitlist_instagram_handle
  ON landing_waitlist_entries (instagram_handle);

CREATE INDEX IF NOT EXISTS idx_waitlist_phone_digits
  ON landing_waitlist_entries (phone_digits);

CREATE INDEX IF NOT EXISTS idx_waitlist_created_at
  ON landing_waitlist_entries (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_waitlist_is_test
  ON landing_waitlist_entries (is_test);
