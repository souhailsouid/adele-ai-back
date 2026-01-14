/**
 * Script pour extraire les détails des données écrites depuis les logs
 * Analyse les logs de synchronisation pour lister toutes les transactions
 */

// D'après les logs fournis, voici un résumé structuré des données écrites

const logData = {
  summary: {
    totalCompanies: 3,
    totalFilings: 19,
    totalTransactions: 0, // Sera calculé
  },
  companies: [
    {
      ticker: 'XXI',
      name: 'Twenty One Capital, Inc.',
      filings: [
        {
          accessionNumber: '0001213900-26-001445',
          owner: 'Nguyen James Cong Hoan',
          ownerCIK: '0002099720',
          transactions: 1,
          type: 'derivative',
          s3Key: 'data/insider_trades/year=2026/month=1/insert_1768413972014_hndd4g.parquet',
          filingId: '1768413971714000',
        },
        {
          accessionNumber: '0001213900-26-001444',
          owner: 'Mallers Jack',
          ownerCIK: '0002091894',
          transactions: 1,
          type: 'derivative',
          s3Key: 'data/insider_trades/year=2025/month=12/insert_1768413977464_pbobms.parquet',
          filingId: '1768413977340002',
        },
        {
          accessionNumber: '0001213900-26-001443',
          owner: 'Meehan Steven',
          ownerCIK: '0001695617',
          transactions: 1,
          type: 'derivative',
          s3Key: 'data/insider_trades/year=2026/month=1/insert_1768413983040_olnhlf.parquet',
          filingId: '1768413982861004',
        },
      ],
    },
    {
      ticker: 'HVMC',
      name: 'Highview Merger Corp.',
      filings: [
        {
          accessionNumber: '0001185185-25-000965',
          owner: 'Highview Sponsor Co., LLC',
          ownerCIK: '0002078602',
          transactions: 1,
          type: 'non-derivative',
          s3Key: 'data/insider_trades/year=2025/month=8/insert_1768413995190_0se78x.parquet',
          filingId: '1768413995047006',
          hasAlert: true, // Transaction > 1M$
        },
      ],
    },
    {
      ticker: 'BLLN',
      name: 'BillionToOne, Inc.',
      filings: [
        {
          accessionNumber: '0002070849-26-000008',
          owner: 'Pagano Anthony',
          ownerCIK: '0002101642',
          transactions: 1,
          type: 'non-derivative',
          s3Key: 'data/insider_trades/year=2026/month=1/insert_1768414006715_gnx2vu.parquet',
          filingId: '1768414006580009',
          shares: 4896, // Extrait avec "direct pattern"
        },
        {
          accessionNumber: '0001193125-25-278144',
          owner: 'Lynch Thomas P.',
          ownerCIK: '0001659824',
          transactions: 11,
          breakdown: { nonDerivative: 3, derivative: 8 },
          s3Key: 'data/insider_trades/year=2025/month=11/insert_1768414012131_c7jfvl.parquet',
          filingId: '1768414012031011',
        },
        {
          accessionNumber: '0001193125-25-278140',
          owner: 'Atay Oguzhan',
          ownerCIK: '0002088549',
          transactions: 14,
          breakdown: { nonDerivative: 8, derivative: 6 },
          s3Key: 'data/insider_trades/year=2025/month=11/insert_1768414017691_txszrr.parquet',
          filingId: '1768414017591023',
        },
        {
          accessionNumber: '0001193125-25-278138',
          owner: 'Tsao David',
          ownerCIK: '0002087127',
          transactions: 9,
          breakdown: { nonDerivative: 4, derivative: 5 },
          s3Key: 'data/insider_trades/year=2025/month=11/insert_1768414023129_kd80hc.parquet',
          filingId: '1768414023040038',
        },
        {
          accessionNumber: '0001193125-25-278137',
          owner: 'Sakakibara Shan Riku',
          ownerCIK: '0002088547',
          transactions: 8,
          breakdown: { nonDerivative: 2, derivative: 6 },
          s3Key: 'data/insider_trades/year=2025/month=11/insert_1768414028696_djfm1.parquet',
          filingId: '1768414028601048',
        },
        {
          accessionNumber: '0001193125-25-278132',
          owner: 'Taylor Ross',
          ownerCIK: '0002013346',
          transactions: 4,
          breakdown: { nonDerivative: 0, derivative: 4 },
          s3Key: 'data/insider_trades/year=2025/month=11/insert_1768414034071_6qn1j.parquet',
          filingId: '1768414033982057',
        },
        {
          accessionNumber: '0001193125-25-278131',
          owner: 'ten Bosch John Roderick',
          ownerCIK: '0002087126',
          transactions: 13,
          breakdown: { nonDerivative: 3, derivative: 10 },
          s3Key: 'data/insider_trades/year=2025/month=11/insert_1768414039493_85cq6a.parquet',
          filingId: '1768414039404062',
        },
        {
          accessionNumber: '0001193125-25-278126',
          owner: 'LISTER JOHN',
          ownerCIK: '0001464741',
          transactions: 2,
          breakdown: { nonDerivative: 0, derivative: 2 },
          s3Key: 'data/insider_trades/year=2025/month=11/insert_1768414045068_dql1j.parquet',
          filingId: '1768414044981076',
        },
        {
          accessionNumber: '0001193125-25-278118',
          owner: 'Johnson Nancy JoAnn',
          ownerCIK: '0002087387',
          transactions: 15,
          breakdown: { nonDerivative: 3, derivative: 12 },
          s3Key: 'data/insider_trades/year=2025/month=11/insert_1768414050473_m4pyl.parquet',
          filingId: '1768414050385079',
        },
        {
          accessionNumber: '0001193125-25-278115',
          owner: 'Rai Akshay',
          ownerCIK: '0002087877',
          transactions: 1,
          type: 'non-derivative',
          s3Key: 'data/insider_trades/year=2025/month=11/insert_1768414055960_m743.parquet',
          filingId: '1768414055865095',
        },
        {
          accessionNumber: '0001193125-25-274956',
          owner: 'Rai Akshay',
          ownerCIK: '0002087877',
          transactions: 9,
          breakdown: { nonDerivative: 7, derivative: 2 },
          shares: 8333, // Extrait avec "direct pattern"
          s3Key: 'data/insider_trades/year=2025/month=11/insert_1768414061393_i9v4wb.parquet',
          filingId: '1768414061299097',
        },
        {
          accessionNumber: '0001193125-25-274951',
          owner: 'KOLLURI KRISHNA KITTU',
          ownerCIK: '0001270521',
          transactions: 19,
          breakdown: { nonDerivative: 12, derivative: 7 },
          shares: 8333, // Extrait avec "direct pattern"
          s3Key: 'data/insider_trades/year=2025/month=11/insert_1768414066932_yxhbts.parquet',
          filingId: '1768414066756107',
        },
        {
          accessionNumber: '0001193125-25-274946',
          owner: 'Ileri Firat',
          ownerCIK: '0002087908',
          transactions: 30,
          breakdown: { nonDerivative: 19, derivative: 11 },
          shares: 8333, // Extrait avec "direct pattern"
          s3Key: 'data/insider_trades/year=2025/month=11/insert_1768414072501_s9wzf.parquet',
          filingId: '1768414072389127',
        },
        {
          accessionNumber: '0001193125-25-274945',
          owner: 'Bremner Thomas S',
          ownerCIK: '0002087538',
          transactions: 57,
          breakdown: { nonDerivative: 30, derivative: 27 },
          shares: 8333, // Extrait avec "direct pattern"
          s3Key: 'data/insider_trades/year=2025/month=11/insert_1768414077979_xb0ul8.parquet',
          filingId: '1768414077886158',
          hasAlert: true, // Transaction > 1M$
        },
        {
          accessionNumber: '0001104659-25-109456',
          owner: 'NeoTribe Ventures I, L.P.',
          ownerCIK: '0001696926',
          transactions: 16,
          breakdown: { nonDerivative: 9, derivative: 7 },
          s3Key: 'data/insider_trades/year=2025/month=11/insert_1768414083435_bti1b.parquet',
          filingId: '1768414083330217',
        },
      ],
    },
  ],
};

// Calculer le total de transactions
let totalTransactions = 0;
logData.companies.forEach(company => {
  company.filings.forEach(filing => {
    totalTransactions += filing.transactions;
  });
});
logData.summary.totalTransactions = totalTransactions;

// Afficher le résumé
console.log('═══════════════════════════════════════════════════════════');
console.log('📊 DÉTAILS DES DONNÉES ÉCRITES DANS LA BASE');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('📈 RÉSUMÉ GLOBAL:');
console.log(`   🏢 Companies: ${logData.summary.totalCompanies}`);
console.log(`   📄 Filings (Form 4): ${logData.summary.totalFilings}`);
console.log(`   💼 Transactions: ${logData.summary.totalTransactions}`);
console.log('');

logData.companies.forEach((company, companyIndex) => {
  console.log(`\n${companyIndex + 1}. 🏢 ${company.ticker} - ${company.name}`);
  console.log(`   📊 ${company.filings.length} filings, ${company.filings.reduce((sum, f) => sum + f.transactions, 0)} transactions`);
  console.log('');
  
  company.filings.forEach((filing, filingIndex) => {
    console.log(`   ${filingIndex + 1}. Filing: ${filing.accessionNumber}`);
    console.log(`      👤 Owner: ${filing.owner} (CIK: ${filing.ownerCIK})`);
    console.log(`      📊 Transactions: ${filing.transactions}`);
    if (filing.breakdown) {
      console.log(`         - Non-derivative: ${filing.breakdown.nonDerivative}`);
      console.log(`         - Derivative: ${filing.breakdown.derivative}`);
    } else if (filing.type) {
      console.log(`         - Type: ${filing.type}`);
    }
    if (filing.shares) {
      console.log(`      📈 Shares extraits: ${filing.shares.toLocaleString()} (via direct pattern)`);
    }
    if (filing.hasAlert) {
      console.log(`      🚨 ALERTE: Transaction > 1M$`);
    }
    console.log(`      📦 S3: ${filing.s3Key}`);
    console.log(`      🆔 Filing ID: ${filing.filingId}`);
    console.log('');
  });
});

console.log('═══════════════════════════════════════════════════════════');
console.log('📊 RÉPARTITION PAR TYPE:');
const stats = {
  nonDerivative: 0,
  derivative: 0,
  withAlerts: 0,
  withDirectPattern: 0,
};
logData.companies.forEach(company => {
  company.filings.forEach(filing => {
    if (filing.breakdown) {
      stats.nonDerivative += filing.breakdown.nonDerivative;
      stats.derivative += filing.breakdown.derivative;
    } else if (filing.type === 'non-derivative') {
      stats.nonDerivative += filing.transactions;
    } else if (filing.type === 'derivative') {
      stats.derivative += filing.transactions;
    }
    if (filing.hasAlert) stats.withAlerts++;
    if (filing.shares) stats.withDirectPattern++;
  });
});
console.log(`   📊 Non-derivative: ${stats.nonDerivative}`);
console.log(`   📊 Derivative: ${stats.derivative}`);
console.log(`   🚨 Alertes créées: ${stats.withAlerts}`);
console.log(`   🔍 Filings avec extraction "direct pattern": ${stats.withDirectPattern}`);
console.log('');

console.log('═══════════════════════════════════════════════════════════');
console.log('✅ ANALYSE TERMINÉE');
console.log('═══════════════════════════════════════════════════════════');
