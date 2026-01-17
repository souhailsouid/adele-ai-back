/**
 * Script pour trouver un accession_number récent pour PGIM
 * Cherche dans les filings directement si les transactions n'ont pas de filing_id
 */

import { executeAthenaQuery } from '../services/api/src/athena/query.js';

async function findPGIMForm4() {
  console.log('🔍 Recherche des Form 4 récents pour PGIM...\n');
  
  // 1. Chercher les transactions avec filing_id
  const queryTransactions = `
    SELECT 
      it.filing_id,
      cf.accession_number,
      cf.cik,
      CAST(cf.filing_date AS VARCHAR) as filing_date,
      it.insider_name,
      it.insider_title,
      it.relation,
      CAST(it.transaction_date AS VARCHAR) as transaction_date,
      c.ticker,
      c.name as company_name
    FROM insider_trades it
    LEFT JOIN companies c ON it.company_id = c.id
    LEFT JOIN company_filings cf ON it.filing_id = cf.id
    WHERE UPPER(TRIM(c.ticker)) = 'PGIM'
      AND LOWER(TRIM(it.transaction_type)) = 'purchase'
      AND it.transaction_date >= date_add('day', -30, CURRENT_DATE)
    ORDER BY it.transaction_date DESC
    LIMIT 10
  `;
  
  const transactions = await executeAthenaQuery(queryTransactions);
  
  // 2. Chercher directement dans les filings pour PGIM
  const queryFilings = `
    SELECT 
      cf.id as filing_id,
      cf.accession_number,
      cf.cik,
      CAST(cf.filing_date AS VARCHAR) as filing_date,
      cf.form_type,
      c.ticker,
      c.name as company_name
    FROM company_filings cf
    LEFT JOIN companies c ON cf.company_id = c.id
    WHERE UPPER(TRIM(c.ticker)) = 'PGIM'
      AND cf.form_type = '4'
      AND cf.filing_date >= date_add('day', -30, CURRENT_DATE)
    ORDER BY cf.filing_date DESC
    LIMIT 10
  `;
  
  const filings = await executeAthenaQuery(queryFilings);
  
  console.log(`📊 Transactions trouvées: ${transactions.length}`);
  console.log(`📄 Filings trouvés: ${filings.length}\n`);
  
  if (transactions.length > 0) {
    console.log('--- Transactions avec filing_id ---');
    transactions.forEach((row: any, i: number) => {
      console.log(`\nTransaction ${i + 1}:`);
      console.log(`  Filing ID: ${row.filing_id || '(NULL)'}`);
      console.log(`  Accession: ${row.accession_number || '(NULL)'}`);
      console.log(`  CIK: ${row.cik || '(NULL)'}`);
      console.log(`  Filing Date: ${row.filing_date || '(NULL)'}`);
      console.log(`  Insider: ${row.insider_name}`);
      console.log(`  Title: ${row.insider_title || '(NULL)'}`);
      console.log(`  Relation: ${row.relation || '(NULL)'}`);
      console.log(`  Transaction Date: ${row.transaction_date}`);
    });
  }
  
  if (filings.length > 0) {
    console.log('\n--- Filings Form 4 trouvés directement ---');
    filings.forEach((row: any, i: number) => {
      console.log(`\nFiling ${i + 1}:`);
      console.log(`  Filing ID: ${row.filing_id}`);
      console.log(`  Accession: ${row.accession_number}`);
      console.log(`  CIK: ${row.cik || '(NULL)'}`);
      console.log(`  Filing Date: ${row.filing_date}`);
      console.log(`  Form Type: ${row.form_type}`);
      console.log(`  Company: ${row.company_name}`);
    });
    
    // Utiliser le premier filing avec accession_number
    const filingWithAccession = filings.find((f: any) => f.accession_number);
    if (filingWithAccession) {
      console.log('\n💡 Pour analyser le Form 4 XML:');
      console.log(`   npx tsx scripts/debug_pgim_form4.ts ${filingWithAccession.accession_number} ${filingWithAccession.cik || '0001759669'}`);
    }
  } else if (transactions.length === 0) {
    console.log('❌ Aucune transaction ou filing PGIM trouvé dans les 30 derniers jours');
    console.log('\n💡 Essayez de chercher manuellement sur SEC.gov:');
    console.log('   https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=4&count=100&output=atom');
    console.log('   Cherchez "PGIM Private Credit Fund" dans les résultats');
  }
}

findPGIMForm4().catch(console.error);
