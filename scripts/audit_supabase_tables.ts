/**
 * Script d'audit des tables Supabase
 * 
 * Usage:
 *   npx tsx scripts/audit_supabase_tables.ts
 * 
 * Objectif:
 *   - Lister toutes les tables
 *   - Compter les rows par table
 *   - Estimer la taille par table
 *   - Identifier les dépendances (foreign keys)
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Charger les variables d'environnement
let dotenvLoaded = false;
try {
  const dotenv = require('dotenv');
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    dotenvLoaded = true;
  }
} catch (e) {
  // dotenv n'est pas installé, parser manuellement
}

if (!dotenvLoaded) {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    try {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      const lines = envContent.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const match = trimmed.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          let value = match[2].trim();
          if ((value.startsWith('"') && value.endsWith('"')) || 
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    } catch (e) {
      // Ignorer les erreurs de parsing
    }
  }
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Erreur: SUPABASE_URL et SUPABASE_SERVICE_KEY sont requis');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface TableAudit {
  table_name: string;
  row_count: number;
  estimated_size_mb: number;
  columns: string[];
  foreign_keys: string[];
}

// Tables principales à auditer
const MAIN_TABLES = [
  'companies',
  'company_filings',
  'funds',
  'fund_filings',
  'fund_holdings',
  'fund_holdings_diff',
  'signals',
  'notifications',
  'earnings_calendar',
  'cron_registry',
  'file_processing_queue',
  'ticker_data',
  'earnings_alerts',
  'flow_alerts',
  'greeks_data',
  'oi_iv_max_pain',
  'price_context',
  'macro_calendar_events',
];

async function getTableRowCount(tableName: string): Promise<number> {
  const { count, error } = await supabase
    .from(tableName)
    .select('*', { count: 'exact', head: true });
  
  if (error) {
    console.warn(`   ⚠️  Erreur pour ${tableName}:`, error.message);
    return 0;
  }
  
  return count || 0;
}

async function getTableColumns(tableName: string): Promise<string[]> {
  // Utiliser une requête SQL directe via RPC ou une requête limitée
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .limit(1);
  
  if (error || !data || data.length === 0) {
    return [];
  }
  
  return Object.keys(data[0]);
}

async function estimateTableSize(tableName: string, rowCount: number): Promise<number> {
  // Estimation basique : ~1KB par row (approximation)
  // Pour des estimations plus précises, il faudrait interroger pg_stat_user_tables
  return (rowCount * 1) / 1024; // MB
}

async function auditTable(tableName: string): Promise<TableAudit | null> {
  console.log(`\n📊 Audit de la table: ${tableName}`);
  
  try {
    const rowCount = await getTableRowCount(tableName);
    const columns = await getTableColumns(tableName);
    const estimatedSize = await estimateTableSize(tableName, rowCount);
    
    console.log(`   ✅ Rows: ${rowCount.toLocaleString()}`);
    console.log(`   ✅ Colonnes: ${columns.length}`);
    console.log(`   ✅ Taille estimée: ${estimatedSize.toFixed(2)} MB`);
    
    return {
      table_name: tableName,
      row_count: rowCount,
      estimated_size_mb: estimatedSize,
      columns,
      foreign_keys: [], // À implémenter si nécessaire
    };
  } catch (error: any) {
    console.error(`   ❌ Erreur lors de l'audit de ${tableName}:`, error.message);
    return null;
  }
}

async function auditAllTables() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 Audit des Tables Supabase');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const results: TableAudit[] = [];
  let totalRows = 0;
  let totalSize = 0;
  
  for (const tableName of MAIN_TABLES) {
    const audit = await auditTable(tableName);
    if (audit) {
      results.push(audit);
      totalRows += audit.row_count;
      totalSize += audit.estimated_size_mb;
    }
    // Pause pour éviter le rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n\n═══════════════════════════════════════════════════════════');
  console.log('📊 RÉSUMÉ');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Trier par nombre de rows décroissant
  results.sort((a, b) => b.row_count - a.row_count);
  
  console.log('Top 10 tables par volume:');
  results.slice(0, 10).forEach((audit, index) => {
    console.log(
      `   ${String(index + 1).padEnd(2)}. ${audit.table_name.padEnd(30)} ` +
      `${audit.row_count.toLocaleString().padStart(12)} rows ` +
      `${audit.estimated_size_mb.toFixed(2).padStart(8)} MB`
    );
  });
  
  console.log(`\n📈 Total:`);
  console.log(`   Rows: ${totalRows.toLocaleString()}`);
  console.log(`   Taille estimée: ${totalSize.toFixed(2)} MB (${(totalSize / 1024).toFixed(2)} GB)`);
  
  // Recommandations de migration
  console.log(`\n💡 Recommandations de Migration:`);
  console.log(`\n   📦 S3 + Athena (gros volumes):`);
  results
    .filter(a => a.row_count > 100000)
    .forEach(a => {
      console.log(`      - ${a.table_name} (${a.row_count.toLocaleString()} rows)`);
    });
  
  console.log(`\n   🗄️  RDS PostgreSQL (données relationnelles):`);
  results
    .filter(a => a.row_count < 100000 && ['companies', 'funds', 'earnings_calendar'].includes(a.table_name))
    .forEach(a => {
      console.log(`      - ${a.table_name} (${a.row_count.toLocaleString()} rows)`);
    });
  
  console.log(`\n   ⚡ DynamoDB (haute fréquence):`);
  results
    .filter(a => ['signals', 'notifications', 'cron_registry'].includes(a.table_name))
    .forEach(a => {
      console.log(`      - ${a.table_name} (${a.row_count.toLocaleString()} rows)`);
    });
  
  // Sauvegarder les résultats dans un fichier JSON
  const outputPath = path.resolve(process.cwd(), 'supabase_audit_results.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Résultats sauvegardés dans: ${outputPath}`);
  
  console.log('\n═══════════════════════════════════════════════════════════\n');
}

auditAllTables().catch(console.error);
