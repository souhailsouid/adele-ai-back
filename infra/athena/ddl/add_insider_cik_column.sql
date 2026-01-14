-- ============================================
-- Migration: Ajouter la colonne insider_cik à insider_trades
-- ============================================
-- Si la table existe déjà, utiliser cette migration pour ajouter la colonne
-- Les fichiers Parquet existants retourneront NULL pour insider_cik (c'est normal)

-- Option 1: Si la table n'existe pas encore, utiliser create_sec_smart_money_tables.sql
-- Option 2: Si la table existe, exécuter cette migration

ALTER TABLE insider_trades ADD COLUMNS (
  insider_cik STRING COMMENT 'CIK du dirigeant (reporting owner)'
);

-- Vérification
DESCRIBE insider_trades;
