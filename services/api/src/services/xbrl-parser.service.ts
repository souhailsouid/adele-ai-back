/**
 * Service de parsing XBRL pour extraire les données financières des 10-Q/10-K
 * 
 * Extrait automatiquement:
 * - Net Income
 * - Total Revenue
 * - Cash & Cash Equivalents
 * 
 * Architecture Extreme Budget: S3 + Athena (pas de Supabase)
 */

import { insertRowS3 } from '../athena/write';

const SEC_EDGAR_BASE_URL = 'https://www.sec.gov';
const USER_AGENT = 'ADEL AI (contact@adel.ai)';

export interface FinancialData {
  net_income: number | null;
  total_revenue: number | null;
  cash_and_equivalents: number | null;
  period_end_date: string;
}

/**
 * Parser un fichier 10-Q ou 10-K pour extraire les données XBRL
 */
export async function parseXBRLFinancials(
  companyId: number,
  filingId: number,
  formType: '10-Q' | '10-K',
  documentUrl: string
): Promise<FinancialData | null> {
  try {
    // Télécharger le document XBRL
    const response = await fetch(documentUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/xml, text/xml, */*',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch XBRL document: ${response.status}`);
    }

    const xmlContent = await response.text();
    
    // Parser le XBRL
    const financialData = parseXBRLXML(xmlContent, formType);
    
    if (financialData) {
      // Insérer dans la base de données
      await insertFinancialData(companyId, filingId, formType, financialData);
    }

    return financialData;
  } catch (error: any) {
    console.error(`[XBRL Parser] Error parsing ${documentUrl}:`, error.message);
    return null;
  }
}

/**
 * Parser le contenu XML XBRL
 * 
 * Structure XBRL:
 * - <xbrl>
 *   - <us-gaap:NetIncomeLoss> (Net Income)
 *   - <us-gaap:Revenues> (Total Revenue)
 *   - <us-gaap:CashAndCashEquivalentsAtCarryingValue> (Cash)
 *   - <dei:DocumentPeriodEndDate> (Period End Date)
 */
function parseXBRLXML(xmlContent: string, formType: '10-Q' | '10-K'): FinancialData | null {
  try {
    // Extraire la date de fin de période
    const periodEndMatch = xmlContent.match(/<dei:DocumentPeriodEndDate[^>]*>([^<]+)<\/dei:DocumentPeriodEndDate>/i) ||
                          xmlContent.match(/<DocumentPeriodEndDate[^>]*>([^<]+)<\/DocumentPeriodEndDate>/i);
    const periodEndDate = periodEndMatch ? formatDate(periodEndMatch[1].trim()) : null;

    // Extraire Net Income
    // Tags possibles: us-gaap:NetIncomeLoss, us-gaap:IncomeLossFromContinuingOperations, etc.
    const netIncome = extractFinancialValue(xmlContent, [
      'us-gaap:NetIncomeLoss',
      'us-gaap:IncomeLossFromContinuingOperations',
      'NetIncomeLoss',
      'IncomeLossFromContinuingOperations',
    ]);

    // Extraire Total Revenue
    // Tags possibles: us-gaap:Revenues, us-gaap:SalesRevenueNet, etc.
    const totalRevenue = extractFinancialValue(xmlContent, [
      'us-gaap:Revenues',
      'us-gaap:SalesRevenueNet',
      'us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax',
      'Revenues',
      'SalesRevenueNet',
    ]);

    // Extraire Cash & Cash Equivalents
    // Tags possibles: us-gaap:CashAndCashEquivalentsAtCarryingValue, us-gaap:CashCashEquivalentsAndShortTermInvestments, etc.
    const cashAndEquivalents = extractFinancialValue(xmlContent, [
      'us-gaap:CashAndCashEquivalentsAtCarryingValue',
      'us-gaap:CashCashEquivalentsAndShortTermInvestments',
      'CashAndCashEquivalentsAtCarryingValue',
      'CashCashEquivalentsAndShortTermInvestments',
    ]);

    if (!periodEndDate) {
      console.warn('[XBRL Parser] No period end date found');
      return null;
    }

    return {
      net_income: netIncome,
      total_revenue: totalRevenue,
      cash_and_equivalents: cashAndEquivalents,
      period_end_date: periodEndDate,
    };
  } catch (error: any) {
    console.error('[XBRL Parser] XML parsing error:', error.message);
    return null;
  }
}

/**
 * Extraire une valeur financière depuis le XML XBRL
 * 
 * Cherche plusieurs tags possibles et retourne la première valeur trouvée
 */
function extractFinancialValue(xmlContent: string, tagNames: string[]): number | null {
  for (const tagName of tagNames) {
    // Chercher avec namespace (us-gaap:NetIncomeLoss)
    const withNamespace = new RegExp(`<${tagName.replace(':', '\\:')}[^>]*>([^<]+)<\/${tagName.replace(':', '\\:')}>`, 'i');
    let match = xmlContent.match(withNamespace);
    
    // Si pas trouvé, chercher sans namespace
    if (!match) {
      const withoutNamespace = new RegExp(`<${tagName.split(':').pop()}[^>]*>([^<]+)<\/${tagName.split(':').pop()}>`, 'i');
      match = xmlContent.match(withoutNamespace);
    }

    if (match) {
      const valueStr = match[1].trim();
      // Parser la valeur (peut contenir des virgules, signes négatifs, etc.)
      const value = parseFinancialNumber(valueStr);
      if (value !== null) {
        return value;
      }
    }
  }

  return null;
}

/**
 * Parser un nombre financier depuis une string
 * 
 * Gère les formats: "1234567", "1,234,567", "-1234567", "(1234567)" pour les négatifs
 */
function parseFinancialNumber(valueStr: string): number | null {
  try {
    // Enlever les parenthèses (indiquent un nombre négatif en comptabilité)
    let cleaned = valueStr.replace(/[()]/g, '');
    
    // Enlever les virgules
    cleaned = cleaned.replace(/,/g, '');
    
    // Enlever les espaces
    cleaned = cleaned.trim();
    
    // Parser le nombre
    const value = parseFloat(cleaned);
    
    // Si la valeur originale avait des parenthèses, c'est négatif
    if (valueStr.includes('(') && valueStr.includes(')')) {
      return -Math.abs(value);
    }
    
    return isNaN(value) ? null : value;
  } catch (error) {
    return null;
  }
}

/**
 * Formater une date au format YYYY-MM-DD
 */
function formatDate(dateStr: string): string {
  // Formats possibles: YYYYMMDD, YYYY-MM-DD, YYYY-MM-DDTHH:MM:SS, etc.
  const cleaned = dateStr.replace(/[^0-9]/g, '');
  if (cleaned.length >= 8) {
    return `${cleaned.substring(0, 4)}-${cleaned.substring(4, 6)}-${cleaned.substring(6, 8)}`;
  }
  return dateStr;
}

/**
 * Insérer les données financières dans S3
 * 
 * Note: Pour éviter les doublons, on vérifie d'abord si le filing_id existe déjà
 * via Athena avant d'insérer
 */
async function insertFinancialData(
  companyId: number,
  filingId: number,
  formType: '10-Q' | '10-K',
  financialData: FinancialData
): Promise<void> {
  // Vérifier si le filing_id existe déjà (via Athena)
  const { executeAthenaQuery } = await import('../athena/query');
  try {
    const checkQuery = `
      SELECT filing_id
      FROM company_financials
      WHERE filing_id = ${filingId}
      LIMIT 1
    `;
    const existing = await executeAthenaQuery(checkQuery);
    
    if (existing && existing.length > 0) {
      console.log(`[XBRL Parser] Financial data already exists for filing ${filingId}, skipping`);
      return;
    }
  } catch (error: any) {
    // Si la table n'existe pas encore, continuer avec l'insertion
    console.warn(`[XBRL Parser] Could not check existing data: ${error.message}`);
  }

  // Insérer sur S3
  await insertRowS3('company_financials', {
    company_id: companyId,
    filing_id: filingId,
    form_type: formType,
    period_end_date: financialData.period_end_date,
    net_income: financialData.net_income,
    total_revenue: financialData.total_revenue,
    cash_and_equivalents: financialData.cash_and_equivalents,
    xbrl_data: JSON.stringify(financialData),
    extraction_method: 'xbrl',
  });

  console.log(`[XBRL Parser] Inserted financial data for company ${companyId}, filing ${filingId}`);
}

/**
 * Parser un 10-Q/10-K depuis une URL SEC
 */
export async function parseXBRLFromUrl(
  companyId: number,
  filingId: number,
  formType: '10-Q' | '10-K',
  accessionNumber: string,
  cik: string,
  primaryDocument?: string
): Promise<FinancialData | null> {
  const cikNumber = cik.replace(/^0+/, '');
  const accessionClean = accessionNumber.replace(/-/g, '');
  
  // Construire l'URL du document XBRL
  // Le document XBRL est généralement dans un sous-dossier "R{accession_number}.htm" ou similaire
  const possibleUrls = primaryDocument
    ? [`${SEC_EDGAR_BASE_URL}${primaryDocument}`]
    : [
        `${SEC_EDGAR_BASE_URL}/Archives/edgar/data/${cikNumber}/${accessionClean}/${accessionNumber}.txt`,
        `${SEC_EDGAR_BASE_URL}/Archives/edgar/data/${cikNumber}/${accessionClean}/R${accessionClean}.htm`,
      ];

  for (const url of possibleUrls) {
    try {
      const financialData = await parseXBRLFinancials(companyId, filingId, formType, url);
      if (financialData) {
        return financialData;
      }
    } catch (error: any) {
      console.log(`[XBRL Parser] Failed to parse ${url}, trying next...`);
      continue;
    }
  }

  console.warn(`[XBRL Parser] Failed to parse XBRL from any URL for ${accessionNumber}`);
  return null;
}
