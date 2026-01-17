-- Migration: Ajouter les colonnes accession_number et source_type à top_insider_signals
-- 
-- ATTENTION: Athena ne supporte pas ALTER TABLE pour ajouter des colonnes.
-- Il faut recréer la table avec les nouvelles colonnes.
--
-- Étapes:
-- 1. Sauvegarder les données existantes (optionnel)
-- 2. DROP TABLE top_insider_signals
-- 3. Recréer avec le nouveau DDL (create_top_insider_signals_table.sql)
-- 4. Les nouvelles insertions auront accession_number et source_type

-- Option 1: Recréer la table (RECOMMANDÉ)
-- DROP TABLE IF EXISTS top_insider_signals;
-- Puis exécuter: infra/athena/ddl/create_top_insider_signals_table.sql

-- Option 2: Créer une nouvelle table et migrer (si données importantes)
-- CREATE EXTERNAL TABLE top_insider_signals_v2 (...)
-- INSERT INTO top_insider_signals_v2 SELECT *, NULL as accession_number, NULL as source_type FROM top_insider_signals;
-- DROP TABLE top_insider_signals;
-- ALTER TABLE top_insider_signals_v2 RENAME TO top_insider_signals;
