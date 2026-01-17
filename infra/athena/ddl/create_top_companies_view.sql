-- Vue pour top 100 companies (mise à jour automatique)
-- Utilisée par le CRON insiders pour éviter de scanner toutes les companies
-- 
-- Note: Athena ne supporte pas les vues matérialisées, mais cette vue
-- est optimisée avec LIMIT 100 pour être rapide

CREATE OR REPLACE VIEW top_companies AS
SELECT 
  id,
  ticker,
  cik,
  name,
  sector,
  industry,
  market_cap,
  ROW_NUMBER() OVER (ORDER BY market_cap DESC NULLS LAST) as rank
FROM companies
WHERE cik IS NOT NULL
  AND cik != ''
  AND market_cap IS NOT NULL
ORDER BY market_cap DESC NULLS LAST
LIMIT 100;

-- Alternative: Table dédiée (si besoin de performance encore meilleure)
-- CREATE TABLE top_companies AS
-- SELECT ... (même requête)
-- Mise à jour quotidienne via CRON
