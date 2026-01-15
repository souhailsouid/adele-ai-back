/**
 * Script pour tester le worker Lambda form4-parser
 * Envoie un message de test dans la queue SQS
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

const sqsClient = new SQSClient({ region: 'eu-west-3' });
const QUEUE_URL = 'https://sqs.eu-west-3.amazonaws.com/956633302249/adel-ai-dev-form4-parser';

async function testForm4ParserLambda() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 TEST DU WORKER LAMBDA FORM4-PARSER');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Test avec un Form 4 récent qui fonctionne (d'après les logs locaux)
  const testMessage = {
    companyId: 7017,
    filingId: Date.now(),
    accessionNumber: '0000950103-26-000473', // Form 4 récent qui fonctionne
    cik: '0001920406',
    primaryDocument: undefined,
  };

  console.log('📤 Envoi d\'un message de test dans la queue SQS...');
  console.log('   Message:', JSON.stringify(testMessage, null, 2));
  console.log('');

  try {
    const result = await sqsClient.send(new SendMessageCommand({
      QueueUrl: QUEUE_URL,
      MessageBody: JSON.stringify(testMessage),
      DelaySeconds: 0, // Traitement immédiat
    }));

    console.log('✅ Message envoyé avec succès !');
    console.log(`   MessageId: ${result.MessageId}`);
    console.log('');
    console.log('📊 PROCHAINES ÉTAPES:');
    console.log('   1. Attendre 10-30 secondes');
    console.log('   2. Vérifier les logs CloudWatch:');
    console.log('      aws logs tail /aws/lambda/adel-ai-dev-form4-parser --follow --region eu-west-3');
    console.log('   3. Vérifier les transactions dans Athena:');
    console.log('      npx tsx scripts/check_new_transactions_parsing.ts');
    console.log('');
  } catch (error: any) {
    console.error('❌ Erreur lors de l\'envoi du message:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testForm4ParserLambda().catch(console.error);
