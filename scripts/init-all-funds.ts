#!/usr/bin/env ts-node

/**
 * Script pour initialiser tous les funds institutionnels premium
 * Utilise l'API REST pour créer les funds et ajouter les CIK supplémentaires
 * 
 * Usage:
 *   ts-node scripts/init-all-funds.ts
 * 
 * Variables d'environnement requises:
 *   - API_BASE_URL: URL de l'API Gateway (ex: https://xxx.execute-api.eu-west-3.amazonaws.com/prod)
 *   - API_TOKEN: Token JWT d'authentification
 */

interface FundToAdd {
  name: string;
  cik: string;
  tier_influence: number;
  category: 'hedge_fund' | 'family_office' | 'mutual_fund' | 'pension_fund' | 'other';
  additionalCiks?: Array<{
    cik: string;
    entity_name: string;
    is_primary?: boolean;
  }>;
}

const PREMIUM_FUNDS: FundToAdd[] = [
  {
    name: 'Berkshire Hathaway',
    cik: '0001067983',
    tier_influence: 5,
    category: 'other',
  },
  {
    name: 'Scion Asset Management',
    cik: '0001649339',
    tier_influence: 5,
    category: 'hedge_fund',
  },
  {
    name: 'BlackRock Inc.',
    cik: '0002012383',
    tier_influence: 5,
    category: 'mutual_fund',
    additionalCiks: [
      {
        cik: '0001364742',
        entity_name: 'BlackRock Advisors LLC',
        is_primary: false,
      },
    ],
  },
  {
    name: 'Pershing Square',
    cik: '0001336528',
    tier_influence: 5,
    category: 'hedge_fund',
  },
  {
    name: 'Bridgewater Associates',
    cik: '0001350694',
    tier_influence: 5,
    category: 'hedge_fund',
  },
  {
    name: 'Appaloosa LP',
    cik: '0001656456',
    tier_influence: 5,
    category: 'hedge_fund',
    additionalCiks: [
      {
        cik: '0001006438',
        entity_name: 'Appaloosa Management',
        is_primary: false,
      },
    ],
  },
  {
    name: 'Renaissance Technologies',
    cik: '0001037389',
    tier_influence: 5,
    category: 'hedge_fund',
  },
  {
    name: 'Tiger Global Management',
    cik: '0001167483',
    tier_influence: 5,
    category: 'hedge_fund',
  },
  {
    name: 'ARK Investment Management',
    cik: '0001697748',
    tier_influence: 4,
    category: 'mutual_fund',
  },
  {
    name: 'Icahn Carl',
    cik: '0000813040',
    tier_influence: 5,
    category: 'hedge_fund',
  },
  {
    name: 'Third Point LLC',
    cik: '0001166379',
    tier_influence: 5,
    category: 'hedge_fund',
  },
  {
    name: 'Vanguard Group Inc',
    cik: '0000102909',
    tier_influence: 5,
    category: 'mutual_fund',
  },
  {
    name: 'Tudor Investment Corp',
    cik: '0000817087',
    tier_influence: 5,
    category: 'hedge_fund',
  },
  {
    name: 'Duquesne Family Office',
    cik: '0001504389',
    tier_influence: 5,
    category: 'family_office',
  },
  {
    name: 'Soros Fund Management',
    cik: '0001029160',
    tier_influence: 5,
    category: 'hedge_fund',
  },
  {
    name: 'Point72 Asset Management',
    cik: '0001603466',
    tier_influence: 5,
    category: 'hedge_fund',
  },
  {
    name: 'Baupost Group',
    cik: '0001061768',
    tier_influence: 5,
    category: 'hedge_fund',
  },
  {
    name: 'Bill & Melinda Gates Foundation Trust',
    cik: '0001166559',
    tier_influence: 4,
    category: 'other',
  },
  {
    name: 'Lone Pine Capital',
    cik: '0001061393',
    tier_influence: 5,
    category: 'hedge_fund',
  },
];

const API_BASE_URL = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_MAIN_URL;
const API_TOKEN = process.env.API_TOKEN || process.env.ACCESS_TOKEN;

if (!API_BASE_URL) {
  console.error('❌ Erreur: API_BASE_URL ou NEXT_PUBLIC_API_MAIN_URL doit être défini');
  process.exit(1);
}

if (!API_TOKEN) {
  console.error('❌ Erreur: API_TOKEN ou ACCESS_TOKEN doit être défini');
  process.exit(1);
}

interface ApiResponse<T> {
  success?: boolean;
  fund?: T;
  funds?: T[];
  error?: string;
  message?: string;
}

interface Fund {
  id: number;
  name: string;
  cik: string;
  tier_influence: number;
  category: string;
  created_at: string;
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error (${response.status}): ${errorText}`);
  }

  return response.json() as Promise<T>;
}

async function checkExistingFunds(): Promise<Map<string, number>> {
  console.log('🔍 Vérification des funds existants...');
  
  try {
    const response = await apiRequest<Fund[] | { funds: Fund[] }>('/funds');
    const funds = Array.isArray(response) ? response : (response as any).funds || [];
    
    const cikMap = new Map<string, number>();
    funds.forEach((fund: Fund) => {
      cikMap.set(fund.cik, fund.id);
    });
    
    console.log(`✅ ${funds.length} fund(s) existant(s) trouvé(s)\n`);
    return cikMap;
  } catch (error: any) {
    console.error('❌ Erreur lors de la vérification des funds:', error.message || error);
    return new Map();
  }
}

async function createFund(fund: FundToAdd): Promise<number | null> {
  try {
    const response = await apiRequest<ApiResponse<Fund> | Fund>('/funds', {
      method: 'POST',
      body: JSON.stringify({
        name: fund.name,
        cik: fund.cik,
        tier_influence: fund.tier_influence,
        category: fund.category,
      }),
    });

    const createdFund = (response as any).fund || response;
    return (createdFund as Fund).id;
  } catch (error: any) {
    if (error.message?.includes('already exists') || error.message?.includes('409')) {
      return null; // Fund existe déjà
    }
    throw error;
  }
}

async function addFundCik(fundId: number, cik: string, entityName: string, isPrimary: boolean = false): Promise<boolean> {
  try {
    await apiRequest(`/funds/${fundId}/ciks`, {
      method: 'POST',
      body: JSON.stringify({
        cik,
        entity_name: entityName,
        is_primary: isPrimary,
      }),
    });
    return true;
  } catch (error: any) {
    if (error.message?.includes('already exists') || error.message?.includes('409')) {
      return false; // CIK existe déjà
    }
    throw error;
  }
}

async function main() {
  console.log('🚀 Initialisation des funds institutionnels premium\n');
  console.log(`📍 API Base URL: ${API_BASE_URL}\n`);

  const existingFunds = await checkExistingFunds();
  
  let added = 0;
  let skipped = 0;
  let errors = 0;
  let ciksAdded = 0;
  let ciksSkipped = 0;

  console.log('📝 Ajout des funds premium...\n');

  for (const fund of PREMIUM_FUNDS) {
    try {
      // Vérifier si le fund existe déjà
      if (existingFunds.has(fund.cik)) {
        const fundId = existingFunds.get(fund.cik)!;
        console.log(`⏭️  ${fund.name} (${fund.cik}) existe déjà (ID: ${fundId}), skip`);
        skipped++;
        
        // Ajouter les CIK supplémentaires même si le fund existe
        if (fund.additionalCiks && fund.additionalCiks.length > 0) {
          for (const additionalCik of fund.additionalCiks) {
            const added = await addFundCik(fundId, additionalCik.cik, additionalCik.entity_name, additionalCik.is_primary || false);
            if (added) {
              console.log(`   ✅ CIK supplémentaire ajouté: ${additionalCik.cik} (${additionalCik.entity_name})`);
              ciksAdded++;
            } else {
              console.log(`   ⏭️  CIK ${additionalCik.cik} existe déjà`);
              ciksSkipped++;
            }
          }
        }
        continue;
      }

      // Créer le fund
      const fundId = await createFund(fund);
      
      if (fundId === null) {
        console.log(`⏭️  ${fund.name} (${fund.cik}) existe déjà, skip`);
        skipped++;
        continue;
      }

      console.log(`✅ ${fund.name} (${fund.cik}) créé (ID: ${fundId})`);
      added++;

      // Ajouter les CIK supplémentaires
      if (fund.additionalCiks && fund.additionalCiks.length > 0) {
        for (const additionalCik of fund.additionalCiks) {
          const added = await addFundCik(fundId, additionalCik.cik, additionalCik.entity_name, additionalCik.is_primary || false);
          if (added) {
            console.log(`   ✅ CIK supplémentaire ajouté: ${additionalCik.cik} (${additionalCik.entity_name})`);
            ciksAdded++;
          } else {
            console.log(`   ⏭️  CIK ${additionalCik.cik} existe déjà`);
            ciksSkipped++;
          }
        }
      }

      // Petit délai pour éviter de surcharger l'API
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error: any) {
      console.error(`❌ Erreur pour ${fund.name} (${fund.cik}):`, error.message);
      errors++;
    }
  }

  console.log('\n📊 Résumé:');
  console.log(`✅ Funds ajoutés: ${added}`);
  console.log(`⏭️  Funds skip (déjà existants): ${skipped}`);
  console.log(`❌ Erreurs: ${errors}`);
  console.log(`📈 Total traité: ${PREMIUM_FUNDS.length}`);
  
  if (ciksAdded > 0 || ciksSkipped > 0) {
    console.log(`\n🔗 CIK supplémentaires:`);
    console.log(`   ✅ Ajoutés: ${ciksAdded}`);
    console.log(`   ⏭️  Skip: ${ciksSkipped}`);
  }

  if (errors > 0) {
    console.log('\n⚠️  Certaines erreurs sont survenues. Vérifiez les logs ci-dessus.');
    process.exit(1);
  } else {
    console.log('\n🎉 Initialisation terminée avec succès !');
    console.log('\n💡 Les filings seront découverts automatiquement par le collector-sec-watcher');
    console.log('   (toutes les 5 minutes, ou 1 minute en période de pic)');
  }
}

main().catch((error) => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});
