-- Migration: Greeks ingestion (gamma/delta exposure aggregated)
-- Adds a dedicated table for the 'greeks' module (Unusual Whales greek-exposure/strike)

CREATE TABLE IF NOT EXISTS greeks (
  id SERIAL PRIMARY KEY,
  ticker CITEXT NOT NULL,
  data_date DATE NOT NULL DEFAULT CURRENT_DATE,
  net_delta_exposure DECIMAL(20, 4),
  net_gamma_exposure DECIMAL(20, 4),
  data JSONB, -- raw + aggregated payload
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_empty_marker BOOLEAN DEFAULT false,
  CONSTRAINT unique_greeks_ticker_date UNIQUE (ticker, data_date)
);

CREATE INDEX IF NOT EXISTS idx_greeks_ticker ON greeks(ticker);
CREATE INDEX IF NOT EXISTS idx_greeks_expires ON greeks(expires_at);
CREATE INDEX IF NOT EXISTS idx_greeks_data_date ON greeks(data_date DESC);





