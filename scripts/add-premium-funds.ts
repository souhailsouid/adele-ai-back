/**
 * Script pour ajouter les institutions premium à suivre
 * Vérifie d'abord les institutions existantes, puis ajoute celles qui manquent
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface FundToAdd {
  name: string;
  cik: string;
  tier_influence: number;
  category: "hedge_fund" | "family_office" | "mutual_fund" | "pension_fund" | "other";
  reason: string;
}

const PREMIUM_FUNDS: FundToAdd[] = [
  {
    name: "Berkshire Hathaway",
    cik: "0001067983",
    tier_influence: 5,
    category: "other",
    reason: "Warren Buffett (L'investisseur n°1 au monde)",
  },
  {
    name: "Scion Asset Management",
    cik: "0001649339",
    tier_influence: 5,
    category: "hedge_fund",
    reason: 'Michael Burry (Le héros de "The Big Short")',
  },
  {
    name: "BlackRock Inc.",
    cik: "0002012383",
    tier_influence: 5,
    category: "mutual_fund",
    reason: "Le plus gros gestionnaire d'actifs au monde",
  },
  {
    name: "Pershing Square",
    cik: "0001336528",
    tier_influence: 5,
    category: "hedge_fund",
    reason: "Bill Ackman (Investisseur activiste célèbre)",
  },
  {
    name: "Bridgewater Associates",
    cik: "0001350694",
    tier_influence: 5,
    category: "hedge_fund",
    reason: "Ray Dalio (Plus gros Hedge Fund au monde)",
  },
  {
    name: "Appaloosa LP",
    cik: "0001656456",
    tier_influence: 5,
    category: "hedge_fund",
    reason: "David Tepper (Expert en retournement de marché)",
  },
  {
    name: "Renaissance Technologies",
    cik: "0001037389",
    tier_influence: 5,
    category: "hedge_fund",
    reason: "Le roi du trading algorithmique (Jim Simons)",
  },
  {
    name: "Tiger Global Management",
    cik: "0001167483",
    tier_influence: 5,
    category: "hedge_fund",
    reason: "Ultra-puissant dans la Tech et les startups",
  },
  {
    name: "ARK Investment Management",
    cik: "0001697748",
    tier_influence: 4,
    category: "mutual_fund",
    reason: "Spécialiste de l'innovation disruptive (Tesla, etc.) - Cathie Wood",
  },
  {
    name: "Icahn Carl",
    cik: "0000813040",
    tier_influence: 5,
    category: "hedge_fund",
    reason: 'Le "raider" original (activisme pur)',
  },
  {
    name: "Third Point LLC",
    cik: "0001166379",
    tier_influence: 5,
    category: "hedge_fund",
    reason: "Daniel Loeb (Hedge fund très influent)",
  },
  {
    name: "Vanguard Group Inc",
    cik: "0000102905",
    tier_influence: 5,
    category: "mutual_fund",
    reason: "Le deuxième géant mondial après BlackRock",
  },
  {
    name: "Tudor Investment Corp",
    cik: "0000817087",
    tier_influence: 5,
    category: "hedge_fund",
    reason: "Paul Tudor Jones (Légende de la macro-économie)",
  },
  {
    name: "Duquesne Family Office",
    cik: "0001504389",
    tier_influence: 5,
    category: "family_office",
    reason: "Stanley Druckenmiller (Ancien bras droit de Soros)",
  },
  {
    name: "Soros Fund Management",
    cik: "0001029160",
    tier_influence: 5,
    category: "hedge_fund",
    reason: "George Soros (Géopolitique et macro-économie)",
  },
  {
    name: "Point72 Asset Management",
    cik: "0001603466",
    tier_influence: 5,
    category: "hedge_fund",
    reason: 'Steve Cohen (Inspiration de la série "Billions")',
  },
  {
    name: "Baupost Group",
    cik: "0001061768",
    tier_influence: 5,
    category: "hedge_fund",
    reason: "Seth Klarman (Le Buffett de la nouvelle génération)",
  },
  {
    name: "Appaloosa Management",
    cik: "0001006438",
    tier_influence: 4,
    category: "hedge_fund",
    reason: "(CIK secondaire de David Tepper)",
  },
  {
    name: "Bill & Melinda Gates Foundation Trust",
    cik: "0001166559",
    tier_influence: 4,
    category: "other",
    reason: "Trust de la fondation Gates (Positions massives)",
  },
  {
    name: "Lone Pine Capital",
    cik: "0001061393",
    tier_influence: 5,
    category: "hedge_fund",
    reason: 'Un des plus gros "Tiger Cubs" (Anciens de Tiger Global)',
  },
];

async function checkExistingFunds(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("funds")
    .select("cik");

  if (error) {
    console.error("Error fetching existing funds:", error);
    throw error;
  }

  return new Set(data?.map((f) => f.cik) || []);
}

async function addFund(fund: FundToAdd): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("funds")
      .insert({
        name: fund.name,
        cik: fund.cik,
        tier_influence: fund.tier_influence,
        category: fund.category,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        // Unique constraint violation - fund already exists
        console.log(`⏭️  ${fund.name} (${fund.cik}) already exists, skipping`);
        return false;
      }
      throw error;
    }

    console.log(`✅ Added: ${fund.name} (${fund.cik}) - ${fund.reason}`);
    return true;
  } catch (error: any) {
    console.error(`❌ Error adding ${fund.name}:`, error.message);
    return false;
  }
}

async function main() {
  console.log("🔍 Checking existing funds...\n");

  const existingCiks = await checkExistingFunds();
  console.log(`Found ${existingCiks.size} existing funds\n`);

  console.log("📝 Adding premium funds...\n");

  let added = 0;
  let skipped = 0;
  let errors = 0;

  for (const fund of PREMIUM_FUNDS) {
    if (existingCiks.has(fund.cik)) {
      console.log(`⏭️  ${fund.name} (${fund.cik}) already exists, skipping`);
      skipped++;
      continue;
    }

    const success = await addFund(fund);
    if (success) {
      added++;
    } else {
      errors++;
    }

    // Petite pause pour éviter de surcharger
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log("\n📊 Summary:");
  console.log(`✅ Added: ${added}`);
  console.log(`⏭️  Skipped (already exists): ${skipped}`);
  console.log(`❌ Errors: ${errors}`);
  console.log(`📈 Total processed: ${PREMIUM_FUNDS.length}`);

  // Afficher les funds ajoutés pour déclencher la découverte de filings
  if (added > 0) {
    console.log("\n💡 Note: Les filings seront automatiquement découverts par le collector-sec-watcher");
    console.log("   (toutes les 5 minutes, ou 1 minute en période de pic)");
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
