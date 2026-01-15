-- Vue pour filtrer les transactions avec dates 1975 (erreur de parsing)
-- Cette vue exclut automatiquement les transactions avec des dates invalides
CREATE OR REPLACE VIEW insider_trades_clean AS
SELECT *
FROM insider_trades
WHERE CAST(transaction_date AS VARCHAR) NOT LIKE '1975-%'
  AND transaction_date IS NOT NULL
  AND CAST(transaction_date AS VARCHAR) >= '1995-01-01'
  AND CAST(transaction_date AS VARCHAR) <= '2030-12-31';
