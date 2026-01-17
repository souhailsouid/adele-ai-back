/**
 * Service d'écriture avec de-dup automatique par accession_number
 * 
 * ⚠️ COST SAFETY: Utilise DynamoDB lookup index pour de-dup rapide
 * Évite les double inserts qui pourraient générer des coûts inutiles
 */

import { insertRowS3 } from './write';
import { getLookup, putLookup } from './lookup-index.service';
import { executeAthenaQuery } from './query';

const ATHENA_DATABASE = process.env.ATHENA_DATABASE || 'adel_ai_dev';

/**
 * Vérifier si un filing existe déjà (de-dup par accession_number)
 * 
 * Utilise DynamoDB index d'abord (ultra rapide), fallback Athena si nécessaire
 */
export async function checkFilingExists(
  accessionNumber: string,
  formType: string
): Promise<{ id: number; status?: string } | null> {
  // 1. Vérifier DynamoDB index d'abord (ultra rapide, pas de S3 GET)
  const filingId = await getLookup(accessionNumber, 'accession->filing');
  if (filingId) {
    // Optionnel: Récupérer le status depuis Athena si nécessaire
    // Pour l'instant, on retourne juste l'ID
    return { id: filingId };
  }

  // 2. Fallback Athena (si index non disponible ou non trouvé)
  try {
    const query = `
      SELECT id, status
      FROM company_filings
      WHERE accession_number = '${accessionNumber.replace(/'/g, "''")}'
        AND form_type = '${formType}'
      LIMIT 1
    `;
    
    const results = await executeAthenaQuery(query);
    if (results && results.length > 0) {
      return {
        id: parseInt(results[0][0], 10),
        status: results[0][1] || null,
      };
    }
  } catch (error: any) {
    console.warn(`[De-dup] Error checking filing ${accessionNumber}:`, error.message);
  }

  return null;
}

/**
 * Insérer un filing avec de-dup automatique
 * 
 * @returns { id, created: boolean } - created=true si nouveau, false si existait déjà
 */
export async function insertFilingS3WithDedup(
  data: {
    company_id?: number;
    company_cik?: string;
    cik?: string;
    form_type: string;
    accession_number: string;
    filing_date: string;
    document_url?: string;
    status?: string;
  }
): Promise<{ id: number; created: boolean }> {
  const { accession_number, form_type } = data;
  
  // Vérifier si existe déjà (de-dup)
  const existing = await checkFilingExists(accession_number, form_type);
  if (existing) {
    console.log(`[De-dup] Filing ${accession_number} already exists (id: ${existing.id}, status: ${existing.status || 'N/A'})`);
    return { id: existing.id, created: false };
  }

  // Insérer nouveau filing
  const result = await insertRowS3('company_filings', {
    ...data,
    status: data.status || 'DISCOVERED',
  });
  
  // Mettre à jour l'index DynamoDB (async, ne bloque pas)
  putLookup(accession_number, 'accession->filing', result.id).catch(err => {
    console.warn(`[De-dup] Could not update lookup index:`, err.message);
  });
  
  return { id: result.id, created: true };
}

/**
 * Batch insert filings avec de-dup
 * 
 * Optimisé pour traiter plusieurs filings en une fois
 */
export async function batchInsertFilingsWithDedup(
  filings: Array<{
    company_id?: number;
    company_cik?: string;
    cik?: string;
    form_type: string;
    accession_number: string;
    filing_date: string;
    document_url?: string;
    status?: string;
  }>
): Promise<{ created: number; skipped: number; errors: number }> {
  if (filings.length === 0) {
    return { created: 0, skipped: 0, errors: 0 };
  }

  // 1. Batch check de-dup (1 requête Athena au lieu de N)
  const accessionNumbers = filings.map(f => f.accession_number);
  const accessionList = accessionNumbers.map(acc => `'${acc.replace(/'/g, "''")}'`).join(', ');
  
  const existingSet = new Set<string>();
  try {
    const query = `
      SELECT DISTINCT accession_number
      FROM company_filings
      WHERE accession_number IN (${accessionList})
    `;
    
    const results = await executeAthenaQuery(query);
    for (const row of results) {
      existingSet.add(row[0]);
    }
  } catch (error: any) {
    console.warn(`[Batch De-dup] Error checking existing filings:`, error.message);
  }

  // 2. Insérer uniquement les nouveaux
  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const filing of filings) {
    if (existingSet.has(filing.accession_number)) {
      skipped++;
      continue;
    }

    try {
      const result = await insertFilingS3WithDedup(filing);
      if (result.created) {
        created++;
      } else {
        skipped++;
      }
    } catch (error: any) {
      console.error(`[Batch De-dup] Error inserting ${filing.accession_number}:`, error.message);
      errors++;
    }
  }

  return { created, skipped, errors };
}
