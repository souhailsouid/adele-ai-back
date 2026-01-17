/**
 * Script pour re-parser un Form 4 filing spécifique
 * 
 * Usage:
 *   npx tsx scripts/reparse_form4_filing.ts <accession_number> <cik>
 * 
 * Exemple:
 *   npx tsx scripts/reparse_form4_filing.ts 0001588670-25-000013 0001045810
 */

import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

// Récupérer l'URL de la queue depuis l'environnement ou utiliser la valeur par défaut
const FORM4_PARSER_QUEUE_URL = process.env.FORM4_PARSER_QUEUE_URL || 'https://sqs.eu-west-3.amazonaws.com/956633302249/adel-ai-dev-form4-parser';

async function reparseForm4Filing(accessionNumber: string, cik: string, companyName?: string, filingDate?: string) {
  const sqsClient = new SQSClient({ region: 'eu-west-3' });

  const message = {
    accessionNumber,
    cik,
    companyName: companyName || 'NVIDIA CORP',
    filingDate: filingDate || new Date().toISOString().split('T')[0],
    sourceType: 'MANUAL_REPARSE' as const,
  };

  console.log(`📤 Envoi du message pour re-parser le filing:`);
  console.log(`   Accession Number: ${accessionNumber}`);
  console.log(`   CIK: ${cik}`);
  console.log(`   Company Name: ${message.companyName}`);
  console.log(`   Filing Date: ${message.filingDate}`);
  console.log(`   Queue URL: ${FORM4_PARSER_QUEUE_URL}`);

  try {
    const command = new SendMessageCommand({
      QueueUrl: FORM4_PARSER_QUEUE_URL,
      MessageBody: JSON.stringify(message),
    });

    const response = await sqsClient.send(command);
    console.log(`✅ Message envoyé avec succès!`);
    console.log(`   MessageId: ${response.MessageId}`);
    console.log(`   MD5OfBody: ${response.MD5OfBody}`);
    console.log(``);
    console.log(`⏳ Le form4-parser Lambda va traiter ce message dans quelques secondes.`);
    console.log(`   Vérifiez les logs CloudWatch pour voir le résultat.`);
  } catch (error: any) {
    console.error(`❌ Erreur lors de l'envoi du message:`, error.message);
    if (error.message?.includes('Queue does not exist')) {
      console.error(`   ⚠️  La queue n'existe pas. Vérifiez FORM4_PARSER_QUEUE_URL.`);
    }
    process.exit(1);
  }
}

// Main
const args = process.argv.slice(2);

if (args.length < 2) {
  console.error(`❌ Usage: npx tsx scripts/reparse_form4_filing.ts <accession_number> <cik> [company_name] [filing_date]`);
  console.error(``);
  console.error(`Exemple:`);
  console.error(`  npx tsx scripts/reparse_form4_filing.ts 0001588670-25-000013 0001045810`);
  console.error(`  npx tsx scripts/reparse_form4_filing.ts 0001588670-25-000013 0001045810 "NVIDIA CORP" "2025-11-06"`);
  process.exit(1);
}

const [accessionNumber, cik, companyName, filingDate] = args;

reparseForm4Filing(accessionNumber, cik, companyName, filingDate)
  .then(() => {
    console.log(`✅ Script terminé avec succès`);
    process.exit(0);
  })
  .catch((error) => {
    console.error(`❌ Erreur:`, error);
    process.exit(1);
  });
