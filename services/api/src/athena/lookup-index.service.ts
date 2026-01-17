/**
 * Service de lookup index (DynamoDB)
 * 
 * Remplace s3-direct-read.ts pour éviter les millions de requêtes S3 GET
 * 
 * Architecture:
 * - DynamoDB PAY_PER_REQUEST (extreme budget)
 * - Lookups ultra rapides (ms vs secondes pour S3)
 * - Coût: $0.25 par million de requêtes (vs $18 pour 43M S3 GET)
 * 
 * Index structure:
 * - lookup_key: ticker, cik, accession_number, cusip
 * - lookup_type: 'ticker->company' | 'cik->company' | 'accession->filing' | 'cusip->ticker'
 * - entity_id: company_id, filing_id, etc.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, BatchGetCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({
  region: process.env.AWS_REGION || 'eu-west-3',
}));

const LOOKUP_TABLE = process.env.LOOKUP_INDEX_TABLE || 'adel-ai-dev-lookup-index';

export type LookupType = 
  | 'ticker->company' 
  | 'cik->company' 
  | 'accession->filing' 
  | 'cusip->ticker'
  | 'company_id->ticker'  // Reverse lookup
  | 'filing_id->accession';  // Reverse lookup

interface LookupEntry {
  lookup_key: string;      // ticker, cik, accession_number, cusip
  lookup_type: LookupType;
  entity_id: number;       // company_id, filing_id
  metadata?: Record<string, any>;  // Additional data (ticker, name, etc.)
  updated_at: string;
}

/**
 * Récupérer un lookup depuis DynamoDB (ultra rapide, pas de S3 GET)
 * 
 * @param key - ticker, cik, accession_number, etc.
 * @param type - Type de lookup
 * @returns entity_id ou null si non trouvé
 */
export async function getLookup(
  key: string,
  type: LookupType
): Promise<number | null> {
  if (!key || !type) {
    return null;
  }

  try {
    const result = await dynamoClient.send(new GetCommand({
      TableName: LOOKUP_TABLE,
      Key: {
        lookup_key: key,
        lookup_type: type,
      },
    }));

    return result.Item?.entity_id || null;
  } catch (error: any) {
    // Ne pas logger en erreur si la table n'existe pas encore (migration progressive)
    if (error.name === 'ResourceNotFoundException') {
      console.warn(`[Lookup] Table ${LOOKUP_TABLE} does not exist yet, returning null`);
      return null;
    }
    console.error(`[Lookup] Error getting ${type} for ${key}:`, error.message);
    return null;
  }
}

/**
 * Batch lookup (pour éviter N requêtes)
 * 
 * @param keys - Array de clés à chercher
 * @param type - Type de lookup
 * @returns Map<key, entity_id>
 */
export async function batchGetLookups(
  keys: string[],
  type: LookupType
): Promise<Map<string, number>> {
  const map = new Map<string, number>();

  if (keys.length === 0) return map;

  // DynamoDB BatchGetItem limite à 100 items
  const BATCH_SIZE = 100;
  
  for (let i = 0; i < keys.length; i += BATCH_SIZE) {
    const batch = keys.slice(i, i + BATCH_SIZE);
    
    try {
      const result = await dynamoClient.send(new BatchGetCommand({
        RequestItems: {
          [LOOKUP_TABLE]: {
            Keys: batch.map(key => ({
              lookup_key: key,
              lookup_type: type,
            })),
          },
        },
      }));

      const items = result.Responses?.[LOOKUP_TABLE] || [];
      for (const item of items) {
        if (item.entity_id) {
          map.set(item.lookup_key, item.entity_id);
        }
      }
    } catch (error: any) {
      if (error.name === 'ResourceNotFoundException') {
        // Table n'existe pas encore, continuer sans erreur
        continue;
      }
      console.error(`[Lookup] Error batch getting ${type}:`, error.message);
    }
  }

  return map;
}

/**
 * Mettre à jour un lookup (appelé lors de l'insertion de données)
 * 
 * @param key - ticker, cik, accession_number, etc.
 * @param type - Type de lookup
 * @param entityId - company_id, filing_id, etc.
 * @param metadata - Données additionnelles (optionnel)
 */
export async function putLookup(
  key: string,
  type: LookupType,
  entityId: number,
  metadata?: Record<string, any>
): Promise<void> {
  if (!key || !type || !entityId) {
    return;
  }

  try {
    await dynamoClient.send(new PutCommand({
      TableName: LOOKUP_TABLE,
      Item: {
        lookup_key: key,
        lookup_type: type,
        entity_id: entityId,
        metadata: metadata || {},
        updated_at: new Date().toISOString(),
      },
    }));
  } catch (error: any) {
    // Ne pas faire échouer l'insertion principale si le lookup échoue
    if (error.name === 'ResourceNotFoundException') {
      console.warn(`[Lookup] Table ${LOOKUP_TABLE} does not exist yet, skipping index update`);
      return;
    }
    console.error(`[Lookup] Error putting ${type} for ${key}:`, error.message);
    // Ne pas throw, l'insertion principale doit continuer
  }
}

/**
 * Batch put lookups (pour éviter N requêtes)
 */
export async function batchPutLookups(
  entries: Array<{ key: string; type: LookupType; entityId: number; metadata?: Record<string, any> }>
): Promise<void> {
  if (entries.length === 0) return;

  // DynamoDB BatchWriteItem limite à 25 items
  const BATCH_SIZE = 25;
  
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    
    try {
      await dynamoClient.send(new BatchWriteCommand({
        RequestItems: {
          [LOOKUP_TABLE]: batch.map(entry => ({
            PutRequest: {
              Item: {
                lookup_key: entry.key,
                lookup_type: entry.type,
                entity_id: entry.entityId,
                metadata: entry.metadata || {},
                updated_at: new Date().toISOString(),
              },
            },
          })),
        },
      }));
    } catch (error: any) {
      if (error.name === 'ResourceNotFoundException') {
        console.warn(`[Lookup] Table ${LOOKUP_TABLE} does not exist yet, skipping batch index update`);
        continue;
      }
      console.error(`[Lookup] Error batch putting lookups:`, error.message);
      // Ne pas throw, continuer avec le reste
    }
  }
}

/**
 * Helper: Récupérer company_id par ticker (avec fallback Athena si index non disponible)
 */
export async function getCompanyIdByTicker(ticker: string): Promise<number | null> {
  // 1. Essayer DynamoDB index d'abord (ultra rapide)
  const id = await getLookup(ticker.toUpperCase(), 'ticker->company');
  if (id) {
    return id;
  }

  // 2. Fallback Athena (si index non disponible ou non trouvé)
  // Note: Cette fonction devrait être dans companies.ts, mais on la met ici pour éviter circular import
  console.warn(`[Lookup] Company ${ticker} not found in index, falling back to Athena`);
  return null; // Le caller devra utiliser Athena directement
}

/**
 * Helper: Récupérer company_id par CIK (avec fallback Athena si index non disponible)
 */
export async function getCompanyIdByCik(cik: string): Promise<number | null> {
  const id = await getLookup(cik, 'cik->company');
  if (id) {
    return id;
  }
  console.warn(`[Lookup] Company CIK ${cik} not found in index, falling back to Athena`);
  return null;
}

/**
 * Helper: Récupérer filing_id par accession_number
 */
export async function getFilingIdByAccession(accessionNumber: string): Promise<number | null> {
  return await getLookup(accessionNumber, 'accession->filing');
}
