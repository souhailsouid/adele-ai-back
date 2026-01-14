/**
 * Test de récupération du secteur d'une entreprise
 * 
 * Usage:
 *   npx tsx tests/companies/test-company-sector.ts
 * 
 * Variables d'environnement requises:
 *   - API_BASE_URL: URL de base de l'API (ex: https://api.personamy.com)
 *   - ACCESS_TOKEN: Token JWT pour l'authentification
 */

const API_BASE_URL = process.env.API_BASE_URL || 'https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod';
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || '';

interface Company {
  id: number;
  ticker: string;
  cik: string;
  name: string;
  sector: string | null;
  industry: string | null;
  market_cap: number | null;
  headquarters_country: string | null;
  headquarters_state: string | null;
  created_at: string;
  updated_at: string;
}

interface EnrichmentResult {
  ticker: string;
  created: boolean;
  updated: boolean;
  sector: string | null;
  industry: string | null;
  error?: string;
}

async function testGetCompanyByTicker(ticker: string): Promise<Company | null> {
  console.log(`\n🔍 Test 1: GET /companies/ticker/${ticker}`);
  console.log('─'.repeat(60));
  
  try {
    const response = await fetch(`${API_BASE_URL}/companies/ticker/${ticker}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`❌ Entreprise ${ticker} non trouvée en base`);
        return null;
      }
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const company: Company = await response.json();
    
    console.log(`✅ Entreprise trouvée:`);
    console.log(`   - ID: ${company.id}`);
    console.log(`   - Ticker: ${company.ticker}`);
    console.log(`   - Nom: ${company.name}`);
    console.log(`   - CIK: ${company.cik}`);
    console.log(`   - Secteur: ${company.sector || '❌ NULL (non enrichi)'}`);
    console.log(`   - Industrie: ${company.industry || 'NULL'}`);
    console.log(`   - Pays: ${company.headquarters_country || 'NULL'}`);
    console.log(`   - État: ${company.headquarters_state || 'NULL'}`);
    
    return company;
  } catch (error: any) {
    console.error(`❌ Erreur: ${error.message}`);
    return null;
  }
}

async function testEnrichCompany(ticker: string, cik?: string): Promise<EnrichmentResult | null> {
  console.log(`\n🔧 Test 2: POST /companies/enrich`);
  console.log('─'.repeat(60));
  
  try {
    const body: any = { ticker };
    if (cik) {
      body.cik = cik;
    }

    const response = await fetch(`${API_BASE_URL}/companies/enrich`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result: EnrichmentResult = await response.json();
    
    console.log(`✅ Enrichissement terminé:`);
    console.log(`   - Ticker: ${result.ticker}`);
    console.log(`   - Créé: ${result.created ? '✅ Oui' : '❌ Non'}`);
    console.log(`   - Mis à jour: ${result.updated ? '✅ Oui' : '❌ Non'}`);
    console.log(`   - Secteur: ${result.sector || '❌ NULL'}`);
    console.log(`   - Industrie: ${result.industry || 'NULL'}`);
    
    if (result.error) {
      console.log(`   ⚠️  Erreur: ${result.error}`);
    }
    
    return result;
  } catch (error: any) {
    console.error(`❌ Erreur: ${error.message}`);
    return null;
  }
}

async function testEnrichBatch(tickers: string[]): Promise<any> {
  console.log(`\n🔧 Test 3: POST /companies/enrich/batch`);
  console.log('─'.repeat(60));
  
  try {
    const response = await fetch(`${API_BASE_URL}/companies/enrich/batch`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tickers }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    
    console.log(`✅ Enrichissement batch terminé:`);
    console.log(`   - Total: ${result.total || result.results?.length || 0}`);
    console.log(`   - Succès: ${result.success || 0}`);
    console.log(`   - Échecs: ${result.failed || 0}`);
    
    if (result.results) {
      console.log(`\n   Détails par ticker:`);
      for (const res of result.results) {
        console.log(`   - ${res.ticker}: ${res.sector || 'NULL'} ${res.error ? `(Erreur: ${res.error})` : ''}`);
      }
    }
    
    return result;
  } catch (error: any) {
    console.error(`❌ Erreur: ${error.message}`);
    return null;
  }
}

async function testFMPProfile(ticker: string): Promise<any> {
  console.log(`\n🌐 Test 4: GET /fmp/sec-filings/profile/${ticker}`);
  console.log('─'.repeat(60));
  
  try {
    const response = await fetch(`${API_BASE_URL}/fmp/sec-filings/profile/${ticker}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    
    if (Array.isArray(data) && data.length > 0) {
      const profile = data[0];
      console.log(`✅ Profil FMP trouvé:`);
      console.log(`   - Symbol: ${profile.symbol}`);
      console.log(`   - CIK: ${profile.cik}`);
      console.log(`   - Nom: ${profile.registrantName}`);
      console.log(`   - Secteur (marketSector): ${profile.marketSector || 'NULL'}`);
      console.log(`   - Industrie (sicDescription): ${profile.sicDescription || 'NULL'}`);
      console.log(`   - Pays: ${profile.country || 'NULL'}`);
      console.log(`   - État: ${profile.state || 'NULL'}`);
    } else {
      console.log(`❌ Aucun profil trouvé pour ${ticker}`);
    }
    
    return data;
  } catch (error: any) {
    console.error(`❌ Erreur: ${error.message}`);
    return null;
  }
}

async function runTests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 TEST: Récupération du Secteur d\'une Entreprise');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`\n📍 API Base URL: ${API_BASE_URL}`);
  console.log(`🔑 Token: ${ACCESS_TOKEN ? '✅ Présent' : '❌ Manquant'}`);
  
  if (!ACCESS_TOKEN) {
    console.error('\n❌ ERREUR: ACCESS_TOKEN manquant dans les variables d\'environnement');
    console.log('\n💡 Usage:');
    console.log('   export ACCESS_TOKEN="votre_token_jwt"');
    console.log('   npx tsx tests/companies/test-company-sector.ts');
    process.exit(1);
  }

  // Test avec plusieurs tickers connus
  const testTickers = ['LULU', 'AAPL', 'TSLA'];
  
  for (const ticker of testTickers) {
    console.log(`\n\n${'═'.repeat(60)}`);
    console.log(`📊 TEST POUR: ${ticker}`);
    console.log('═'.repeat(60));
    
    // Test 1: Récupérer depuis la base
    const company = await testGetCompanyByTicker(ticker);
    
    // Test 2: Enrichir si secteur manquant
    if (!company || !company.sector) {
      console.log(`\n⚠️  Secteur manquant, enrichissement depuis FMP...`);
      await testEnrichCompany(ticker, company?.cik);
      
      // Re-vérifier après enrichissement
      console.log(`\n🔄 Vérification après enrichissement...`);
      await testGetCompanyByTicker(ticker);
    }
    
    // Test 3: Profil FMP direct (optionnel)
    // await testFMPProfile(ticker);
    
    // Petite pause entre les tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Test 4: Enrichissement batch
  console.log(`\n\n${'═'.repeat(60)}`);
  console.log(`📦 TEST BATCH`);
  console.log('═'.repeat(60));
  await testEnrichBatch(['MSFT', 'GOOGL', 'AMZN']);
  
  console.log(`\n\n${'═'.repeat(60)}`);
  console.log('✅ TESTS TERMINÉS');
  console.log('═'.repeat(60));
}

// Exécuter les tests
runTests().catch(error => {
  console.error('\n❌ Erreur fatale:', error);
  process.exit(1);
});
