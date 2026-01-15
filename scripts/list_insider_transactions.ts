/**
 * Script pour lister 100 transactions insider de manière lisible
 * 
 * Usage:
 *   npx tsx scripts/list_insider_transactions.ts
 */

// Charger les variables d'environnement si disponibles
try {
  const dotenv = require('dotenv');
  dotenv.config({ path: '.env.local' });
} catch (e) {
  // dotenv n'est pas disponible, utiliser les variables d'environnement système
}

import { executeAthenaQuery } from '../services/api/src/athena/query';

function formatCurrency(value: number | string | null | undefined): string {
  const num = typeof value === 'string' ? parseFloat(value) : (value || 0);
  if (isNaN(num) || num === 0) return 'N/A';
  if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
  if (num >= 1000) return `$${(num / 1000).toFixed(2)}K`;
  return `$${num.toFixed(2)}`;
}

function formatShares(shares: number | string | null | undefined): string {
  const num = typeof shares === 'string' ? parseFloat(shares) : (shares || 0);
  if (isNaN(num) || num === 0) return 'N/A';
  if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
  return Math.floor(num).toLocaleString();
}

function getTransactionEmoji(type: string | null | undefined): string {
  if (!type) return '❓';
  const lowerType = type.toLowerCase();
  if (lowerType === 'purchase' || lowerType === 'buy') return '🟢';
  if (lowerType === 'sale' || lowerType === 'sell') return '🔴';
  if (lowerType === 'grant') return '🎁';
  if (lowerType === 'exercise') return '⚡';
  if (lowerType === 'conversion') return '🔄';
  if (lowerType === 'gift') return '💝';
  if (lowerType === 'tax payment') return '💰';
  return '📋';
}

async function listTransactions() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📋 LISTE DE 100 TRANSACTIONS INSIDER');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    const query = `
      SELECT 
        it.id,
        it.transaction_date,
        c.ticker,
        c.name as company_name,
        it.insider_name,
        it.relation,
        it.transaction_type,
        it.shares,
        it.price_per_share,
        it.total_value,
        it.alert_flag,
        it.insider_cik
      FROM insider_trades it
      LEFT JOIN companies c ON it.company_id = c.id
      WHERE it.transaction_date IS NOT NULL
        AND it.shares > 0
        AND it.total_value IS NOT NULL
      ORDER BY it.transaction_date DESC, it.total_value DESC
      LIMIT 100
    `;

    const results = await executeAthenaQuery(query);
    
    if (!results || results.length === 0) {
      console.log('❌ Aucune transaction trouvée');
      return;
    }

    console.log(`✅ ${results.length} transactions trouvées\n`);
    console.log('═'.repeat(100));
    console.log('');

    results.forEach((row: any, index: number) => {
      const id = row.id || row[0];
      const date = (row.transaction_date || row[1]) ? new Date(row.transaction_date || row[1]).toISOString().split('T')[0] : 'N/A';
      const ticker = row.ticker || row[2] || 'N/A';
      const companyName = row.company_name || row[3] || 'N/A';
      const insiderName = row.insider_name || row[4] || 'N/A';
      const relation = row.relation || row[5] || 'N/A';
      const type = row.transaction_type || row[6] || 'N/A';
      const shares = row.shares || row[7];
      const price = row.price_per_share || row[8];
      const totalValue = row.total_value || row[9];
      const alertFlag = (row.alert_flag === true || row.alert_flag === 'true' || row[10] === true || row[10] === 'true');
      const insiderCik = row.insider_cik || row[11] || 'N/A';

      const emoji = getTransactionEmoji(type);
      const alertBadge = alertFlag ? '🚨 ALERT' : '';

      console.log(`${index + 1}. ${emoji} ${type.toUpperCase()} ${alertBadge}`);
      console.log(`   📅 Date: ${date}`);
      console.log(`   🏢 Company: ${ticker} - ${companyName}`);
      console.log(`   👤 Insider: ${insiderName} (${relation})`);
      console.log(`   🆔 CIK: ${insiderCik}`);
      console.log(`   📊 Shares: ${formatShares(shares)} @ ${formatCurrency(price)}`);
      console.log(`   💵 Total Value: ${formatCurrency(totalValue)}`);
      console.log(`   🔑 ID: ${id}`);
      console.log('');
      console.log('─'.repeat(100));
      console.log('');
    });

    // Statistiques résumées
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📊 STATISTIQUES RÉSUMÉES');
    console.log('═══════════════════════════════════════════════════════════\n');

    const purchases = results.filter((r: any) => {
      const type = ((r.transaction_type || r[6]) || '').toLowerCase();
      return type === 'purchase' || type === 'buy';
    });
    const sales = results.filter((r: any) => {
      const type = ((r.transaction_type || r[6]) || '').toLowerCase();
      return type === 'sale' || type === 'sell';
    });
    const alerts = results.filter((r: any) => r.alert_flag === true || r.alert_flag === 'true' || r[10] === true || r[10] === 'true');

    const totalPurchaseValue = purchases.reduce((sum: number, r: any) => sum + (parseFloat((r.total_value || r[9]) || '0') || 0), 0);
    const totalSaleValue = sales.reduce((sum: number, r: any) => sum + (parseFloat((r.total_value || r[9]) || '0') || 0), 0);

    console.log(`🟢 Purchases: ${purchases.length} transactions (${formatCurrency(totalPurchaseValue)})`);
    console.log(`🔴 Sales: ${sales.length} transactions (${formatCurrency(totalSaleValue)})`);
    console.log(`🚨 Alerts (>$1M): ${alerts.length} transactions`);
    console.log(`📈 Net Flow: ${formatCurrency(totalPurchaseValue - totalSaleValue)}`);
    console.log('');

  } catch (error: any) {
    console.error('❌ Erreur lors de la récupération des transactions:', error.message);
    console.error(error.stack);
  }
}

listTransactions().catch(console.error);
