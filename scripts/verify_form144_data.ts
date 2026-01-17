/**
 * Script pour vérifier les données Form 144 dans Athena
 */

import { AthenaClient, StartQueryExecutionCommand, GetQueryExecutionCommand, GetQueryResultsCommand } from '@aws-sdk/client-athena';

const athenaClient = new AthenaClient({});
const ATHENA_DATABASE = process.env.ATHENA_DATABASE || 'adel_ai_dev';
const ATHENA_WORK_GROUP = process.env.ATHENA_WORK_GROUP || 'adel-ai-dev-workgroup';
const ATHENA_RESULTS_BUCKET = process.env.ATHENA_RESULTS_BUCKET || 'adel-ai-dev-athena-results';

async function executeAthenaQuery(query: string): Promise<any[]> {
  const queryExecution = await athenaClient.send(new StartQueryExecutionCommand({
    QueryString: query,
    QueryExecutionContext: { Database: ATHENA_DATABASE },
    ResultConfiguration: {
      OutputLocation: `s3://${ATHENA_RESULTS_BUCKET}/queries/`,
    },
    WorkGroup: ATHENA_WORK_GROUP,
  }));

  const queryExecutionId = queryExecution.QueryExecutionId;
  if (!queryExecutionId) {
    throw new Error('Failed to start query');
  }

  // Attendre la fin de l'exécution
  let status = 'RUNNING';
  while (status === 'RUNNING' || status === 'QUEUED') {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const statusResult = await athenaClient.send(new GetQueryExecutionCommand({
      QueryExecutionId: queryExecutionId,
    }));
    status = statusResult.QueryExecution?.Status?.State || 'FAILED';

    if (status === 'FAILED' || status === 'CANCELLED') {
      const reason = statusResult.QueryExecution?.Status?.StateChangeReason || 'Unknown error';
      throw new Error(`Query failed: ${reason}`);
    }
  }

  // Récupérer les résultats
  const results = await athenaClient.send(new GetQueryResultsCommand({
    QueryExecutionId: queryExecutionId,
  }));

  if (!results.ResultSet?.Rows) {
    return [];
  }

  // Convertir les résultats en objets
  const columns = results.ResultSet.ResultSetMetadata?.ColumnInfo || [];
  const rows = results.ResultSet.Rows.slice(1); // Skip header

  return rows.map(row => {
    const obj: any = {};
    row.Data?.forEach((cell, index) => {
      const colName = columns[index]?.Name || `col${index}`;
      obj[colName] = cell.VarCharValue || null;
    });
    return obj;
  });
}

async function main() {
  console.log('🔍 Vérification des données Form 144 dans Athena...\n');

  try {
    // 1. Compter le total
    console.log('1️⃣  Comptage total...');
    const countQuery = `SELECT COUNT(*) as total FROM form_144_notices`;
    const countResults = await executeAthenaQuery(countQuery);
    const total = countResults[0]?.total || '0';
    console.log(`   📊 Total notices: ${total}\n`);

    if (parseInt(total) === 0) {
      console.log('⚠️  Aucune donnée trouvée. Vérification des partitions...\n');
      
      // Vérifier les partitions
      const partitionQuery = `SHOW PARTITIONS form_144_notices`;
      const partitions = await executeAthenaQuery(partitionQuery);
      console.log(`   📂 Partitions détectées: ${partitions.length}`);
      if (partitions.length > 0) {
        partitions.forEach((p: any) => {
          const partition = Object.values(p)[0] as string;
          console.log(`      - ${partition}`);
        });
      } else {
        console.log('      ⚠️  Aucune partition détectée');
        console.log('      💡 Essayez: MSCK REPAIR TABLE form_144_notices');
      }
      return;
    }

    // 2. Afficher les détails
    console.log('2️⃣  Détails des notices (10 dernières)...');
    const detailsQuery = `
      SELECT 
        accession_number,
        company_name,
        insider_name,
        shares,
        price_per_share,
        total_value,
        CAST(filing_date AS VARCHAR) as filing_date,
        CAST(proposed_sale_date AS VARCHAR) as proposed_sale_date
      FROM form_144_notices
      ORDER BY filing_date DESC
      LIMIT 10
    `;
    const details = await executeAthenaQuery(detailsQuery);
    
    details.forEach((row, i) => {
      console.log(`\n   ${i + 1}. ${row.company_name || 'N/A'} - ${row.insider_name || 'N/A'}`);
      console.log(`      - Accession: ${row.accession_number || 'N/A'}`);
      console.log(`      - Shares: ${row.shares ? parseInt(row.shares).toLocaleString() : 'N/A'}`);
      console.log(`      - Price: $${row.price_per_share ? parseFloat(row.price_per_share).toFixed(2) : 'N/A'}`);
      console.log(`      - Total: $${row.total_value ? parseFloat(row.total_value).toLocaleString(undefined, { maximumFractionDigits: 2 }) : 'N/A'}`);
      console.log(`      - Filing: ${row.filing_date?.substring(0, 10) || 'N/A'}`);
      console.log(`      - Proposed Sale: ${row.proposed_sale_date?.substring(0, 10) || 'N/A'}`);
    });

    // 3. Statistiques
    console.log('\n3️⃣  Statistiques...');
    const statsQuery = `
      SELECT 
        COUNT(DISTINCT company_name) as companies,
        SUM(shares) as total_shares,
        AVG(total_value) as avg_value,
        MAX(CAST(filing_date AS VARCHAR)) as last_filing
      FROM form_144_notices
    `;
    const stats = await executeAthenaQuery(statsQuery);
    const stat = stats[0];
    console.log(`   - Companies: ${stat.companies || 0}`);
    console.log(`   - Total shares: ${stat.total_shares ? parseFloat(stat.total_shares).toLocaleString() : 'N/A'}`);
    console.log(`   - Valeur moyenne: $${stat.avg_value ? parseFloat(stat.avg_value).toLocaleString(undefined, { maximumFractionDigits: 2 }) : 'N/A'}`);
    console.log(`   - Dernier filing: ${stat.last_filing?.substring(0, 10) || 'N/A'}`);

  } catch (error: any) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

main();
