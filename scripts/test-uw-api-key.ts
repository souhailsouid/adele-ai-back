/**
 * Script de diagnostic pour tester la clé API Unusual Whales
 * Usage: npx tsx scripts/test-uw-api-key.ts [API_KEY]
 */

const apiKey = process.argv[2] || process.env.UNUSUAL_WHALES_API_KEY;

if (!apiKey) {
  console.error('❌ Erreur: UNUSUAL_WHALES_API_KEY manquante');
  console.log('\nUsage:');
  console.log('  npx tsx scripts/test-uw-api-key.ts [API_KEY]');
  console.log('  ou définir UNUSUAL_WHALES_API_KEY dans .env');
  process.exit(1);
}

const trimmedApiKey = apiKey.trim();

if (!trimmedApiKey || trimmedApiKey.length === 0) {
  console.error('❌ Erreur: La clé API est vide ou ne contient que des espaces');
  process.exit(1);
}

console.log('🔍 Diagnostic de la clé API Unusual Whales\n');
console.log(`Longueur: ${trimmedApiKey.length} caractères`);
console.log(`Préfixe: ${trimmedApiKey.substring(0, 10)}...`);
console.log(`Suffixe: ...${trimmedApiKey.substring(Math.max(0, trimmedApiKey.length - 4))}`);
console.log(`Contient des espaces: ${trimmedApiKey !== apiKey ? 'OUI (problème!)' : 'NON'}\n`);

// Tester l'API avec un endpoint simple
const testEndpoint = 'https://api.unusualwhales.com/api/option-trades/flow-alerts?limit=1&min_premium=1000000';

console.log('🧪 Test de connexion à l\'API Unusual Whales...\n');

fetch(testEndpoint, {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${trimmedApiKey}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
})
  .then(async (response) => {
    const responseText = await response.text();
    let responseData: any;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }

    if (response.ok) {
      console.log('✅ Succès! La clé API est valide\n');
      console.log(`Status: ${response.status} ${response.statusText}`);
      console.log(`Réponse:`, JSON.stringify(responseData, null, 2).substring(0, 500));
      process.exit(0);
    } else {
      console.error(`❌ Erreur ${response.status}: ${response.statusText}\n`);
      console.error('Réponse:', responseData);
      
      if (response.status === 401) {
        console.error('\n🔴 Problème d\'authentification détecté!');
        console.error('\nCauses possibles:');
        console.error('  1. La clé API est invalide ou a expiré');
        console.error('  2. La clé API n\'a pas les permissions nécessaires');
        console.error('  3. Le format de la clé est incorrect');
        console.error('\nSolutions:');
        console.error('  1. Vérifier la clé dans votre compte Unusual Whales');
        console.error('  2. Générer une nouvelle clé si nécessaire');
        console.error('  3. Mettre à jour la variable dans Terraform:');
        console.error('     terraform apply -var="unusual_whales_api_key=VOTRE_NOUVELLE_CLE"');
        console.error('  4. Redéployer la Lambda après la mise à jour');
      }
      
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('❌ Erreur de connexion:', error.message);
    console.error('\nVérifiez:');
    console.error('  - Votre connexion internet');
    console.error('  - Que l\'API Unusual Whales est accessible');
    process.exit(1);
  });
