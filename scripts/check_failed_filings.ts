/**
 * Script pour vérifier les filings FAILED dans Athena
 * Affiche les dates d'insertion et les détails
 */

import { executeAthenaQuery } from '../services/api/src/athena/query.js';

async function checkFailedFilings() {
  console.log('🔍 Vérification des filings FAILED pour NVIDIA (NVDA)...\n');

  try {
    // Récupérer les filings FAILED pour NVIDIA
    const query = `
      SELECT 
        cf.id,
        cf.accession_number,
        CAST(cf.filing_date AS VARCHAR) as filing_date,
        CAST(cf.created_at AS VARCHAR) as created_at,
        CAST(cf.updated_at AS VARCHAR) as updated_at,
        cf.status,
        c.ticker,
        c.name as company_name
      FROM company_filings cf
      LEFT JOIN companies c ON cf.company_id = c.id
      WHERE c.ticker = 'NVDA'
        AND cf.status = 'FAILED'
      ORDER BY cf.created_at DESC
      LIMIT 10
    `;

    const results = await executeAthenaQuery(query);

    console.log(`📊 ${results.length} filings FAILED trouvés pour NVDA\n`);

    if (results.length > 0) {
      console.log('📋 Détails des filings FAILED:');
      console.log('='.repeat(80));
      
      for (const filing of results) {
        console.log(`\n• Filing ID: ${filing.id}`);
        console.log(`  Accession: ${filing.accession_number}`);
        console.log(`  Company: ${filing.company_name} (${filing.ticker})`);
        console.log(`  Filing Date: ${filing.filing_date}`);
        console.log(`  Status: ${filing.status}`);
        console.log(`  Created At: ${filing.created_at}`);
        console.log(`  Updated At: ${filing.updated_at}`);
        
        // Vérifier s'il y a des transactions
        const txQuery = `
          SELECT COUNT(*) as count
          FROM insider_trades
          WHERE filing_id = ${filing.id}
        `;
        const txResults = await executeAthenaQuery(txQuery);
        const txCount = parseInt(txResults[0]?.count || '0', 10);
        console.log(`  Transactions: ${txCount}`);
      }
    } else {
      console.log('✅ Aucun filing FAILED trouvé pour NVDA');
    }

    // Vérifier aussi les filings récents (tous statuts)
    console.log('\n\n📊 Filings récents pour NVDA (tous statuts):');
    console.log('='.repeat(80));
    
    const recentQuery = `
      SELECT 
        cf.id,
        cf.accession_number,
        CAST(cf.filing_date AS VARCHAR) as filing_date,
        CAST(cf.created_at AS VARCHAR) as created_at,
        cf.status,
        (SELECT COUNT(*) FROM insider_trades WHERE filing_id = cf.id) as transaction_count
      FROM company_filings cf
      LEFT JOIN companies c ON cf.company_id = c.id
      WHERE c.ticker = 'NVDA'
        AND cf.form_type = '4'
      ORDER BY cf.created_at DESC
      LIMIT 10
    `;

    const recentResults = await executeAthenaQuery(recentQuery);
    
    console.log(`\n📋 ${recentResults.length} filings récents trouvés:\n`);
    
    for (const filing of recentResults) {
      const statusIcon = filing.status === 'PARSED' ? '✅' : filing.status === 'FAILED' ? '❌' : '⏳';
      console.log(`${statusIcon} ${filing.accession_number} | ${filing.status} | ${filing.transaction_count} transactions | Created: ${filing.created_at}`);
    }

  } catch (error: any) {
    console.error('❌ Erreur:', error.message);
    console.error(error.stack);
  }
}

checkFailedFilings().catch(console.error);
