-- ============================================
-- 015_macro_calendar_events.sql
-- Ingestion dédiée pour le calendrier macro (US/CN/JP uniquement)
-- Table "macro_calendar_events" (non ticker-specific)
-- ============================================

CREATE TABLE IF NOT EXISTS macro_calendar_events (
  id SERIAL PRIMARY KEY,
  scope TEXT NOT NULL DEFAULT 'US/CN/JP', -- currently only scope we care about
  date DATE NOT NULL,
  event TEXT NOT NULL,
  country TEXT,
  currency TEXT,
  impact TEXT,
  time TEXT,
  source TEXT, -- 'FMP' | 'UW' | 'BOTH' | null
  data JSONB, -- optional raw/merged payload (kept small)
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_macro_calendar_event UNIQUE (scope, date, event)
);

CREATE INDEX IF NOT EXISTS idx_macro_calendar_events_scope_date
  ON macro_calendar_events(scope, date);
CREATE INDEX IF NOT EXISTS idx_macro_calendar_events_expires
  ON macro_calendar_events(expires_at);

-- Auto-update updated_at (function defined in migration 009)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'update_updated_at_column'
  ) THEN
    DROP TRIGGER IF EXISTS update_macro_calendar_events_updated_at ON macro_calendar_events;
    CREATE TRIGGER update_macro_calendar_events_updated_at
      BEFORE UPDATE ON macro_calendar_events
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;




