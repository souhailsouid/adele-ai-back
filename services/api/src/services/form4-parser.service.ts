/**
 * Service de parsing des Form 4 (Insider Transactions)
 * 
 * Parse les fichiers XML Form 4 depuis SEC EDGAR
 * Extrait: nom, relation, type d'opération, prix, valeur totale
 * 
 * Architecture Extreme Budget: S3 + Athena (pas de Supabase)
 */

import { insertRowsS3 } from '../athena/write';
import { filterTopSignals, insertTopSignals } from './top-signals.service';
import { alertTopSignals } from './signal-alerts.service';

const SEC_EDGAR_BASE_URL = 'https://www.sec.gov';
const USER_AGENT = 'ADEL AI (contact@adel.ai)';

export interface InsiderTransaction {
  insider_name: string;
  insider_cik?: string; // CIK du dirigeant (reporting owner)
  relation: string; // CEO, CFO, Director, etc.
  transaction_type: string; // Purchase, Sale, Option Exercise, Grant, etc.
  shares: number;
  price_per_share: number;
  total_value: number;
  transaction_date: string;
  security_title?: string;
  ownership_nature?: string; // Direct, Indirect
}

/**
 * Parser un fichier Form 4 XML depuis SEC EDGAR
 */
export async function parseForm4(
  companyId: number,
  filingId: number,
  documentUrl: string,
  accessionNumber?: string
): Promise<InsiderTransaction[]> {
  try {
    // Télécharger le document XML
    const response = await fetch(documentUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/xml, text/xml, */*',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Form 4: ${response.status}`);
    }

    let xmlContent = await response.text();
    
    // Log la taille et un échantillon du XML pour diagnostic
    console.log(`[Form4 Parser] Downloaded content (${xmlContent.length} chars), checking structure...`);
    
    // Si c'est un fichier .txt, extraire la section XML
    if (documentUrl.endsWith('.txt')) {
      // Le fichier .txt contient <SEC-DOCUMENT><DOCUMENT><TEXT><XML>...</XML></TEXT></DOCUMENT></SEC-DOCUMENT>
      // Chercher la balise <XML> qui contient le XML brut
      const xmlMatch = xmlContent.match(/<XML>([\s\S]*?)<\/XML>/i);
      
      if (xmlMatch) {
        xmlContent = xmlMatch[1];
        console.log(`[Form4 Parser] Extracted XML section from .txt file (${xmlContent.length} chars)`);
      } else {
        // Si pas de balise <XML>, chercher directement <ownershipDocument>
        const ownershipMatch = xmlContent.match(/(<ownershipDocument[\s\S]*<\/ownershipDocument>)/i);
        if (ownershipMatch) {
          xmlContent = ownershipMatch[1];
          console.log(`[Form4 Parser] Extracted ownershipDocument from .txt file (${xmlContent.length} chars)`);
        } else {
          console.warn(`[Form4 Parser] Could not find XML section in .txt file, using full content`);
        }
      }
    }
    
    // Vérifier si c'est du HTML (ownership.xml formaté)
    if (xmlContent.trim().startsWith('<!DOCTYPE html') || xmlContent.trim().startsWith('<html')) {
      console.warn(`[Form4 Parser] File appears to be HTML formatted, not XML. Trying to extract XML from HTML...`);
      // Chercher des balises XML dans le HTML (peu probable mais possible)
      const xmlInHtml = xmlContent.match(/(<ownershipDocument[\s\S]*<\/ownershipDocument>)/i);
      if (xmlInHtml) {
        xmlContent = xmlInHtml[1];
        console.log(`[Form4 Parser] Extracted XML from HTML (${xmlContent.length} chars)`);
      } else {
        throw new Error('File is HTML formatted and contains no XML data. Use .txt file instead.');
      }
    }
    
    if (xmlContent.length < 500) {
      console.warn(`[Form4 Parser] XML content is very short, might be an error page`);
      console.warn(`[Form4 Parser] First 200 chars: ${xmlContent.substring(0, 200)}`);
    }
    
    // Parser le XML
    const transactions = parseForm4XML(xmlContent);
    const accNum = accessionNumber || 'unknown';
    console.log(`[Form4 Parser] Extracted ${transactions.length} transactions from Form 4 ${accNum}`);
    
    // LOG DÉTAILLÉ AVANT INSERTION (pour diagnostic)
    if (transactions.length > 0) {
      console.log(`\n[Form4 Parser] 📊 DÉTAILS DES TRANSACTIONS (AVANT INSERTION):`);
      transactions.forEach((t, i) => {
        console.log(`\n  Transaction ${i + 1}:`);
        console.log(`    - Insider: ${t.insider_name} (CIK: ${t.insider_cik || 'N/A'})`);
        console.log(`    - Relation: ${t.relation}`);
        console.log(`    - Type: ${t.transaction_type}`);
        console.log(`    - Shares: ${t.shares}`);
        console.log(`    - Price: $${t.price_per_share}`);
        console.log(`    - Total: $${t.total_value}`);
        console.log(`    - Date: ${t.transaction_date}`);
        console.log(`    - Security: ${t.security_title || 'N/A'}`);
        console.log(`    - Ownership: ${t.ownership_nature || 'N/A'}`);
      });
      console.log(`\n[Form4 Parser] ✅ ${transactions.length} transactions prêtes à être insérées`);
    } else {
      console.warn(`[Form4 Parser] ⚠️  No transactions extracted from Form 4 ${accNum}`);
    }
    
    // Insérer les transactions dans la base de données
    if (transactions.length > 0) {
      console.log(`\n[Form4 Parser] 💾 Insertion dans la base de données...`);
      await insertInsiderTransactions(companyId, filingId, transactions);
      console.log(`[Form4 Parser] ✅ Insertion terminée`);
    }

    return transactions;
  } catch (error: any) {
    console.error(`[Form4 Parser] Error parsing ${documentUrl}:`, error.message);
    throw error;
  }
}

/**
 * Parser le contenu XML d'un Form 4
 * 
 * Structure XML Form 4:
 * - <ownershipDocument>
 *   - <reportingOwner>
 *     - <reportingOwnerId>
 *       - <rptOwnerName>
 *       - <rptOwnerCik>
 *   - <nonDerivativeTable>
 *     - <nonDerivativeTransaction>
 *       - <transactionDate>
 *       - <transactionCode>
 *       - <transactionShares>
 *       - <transactionPricePerShare>
 *       - <transactionAcquiredDisposedCode>
 *   - <derivativeTable>
 *     - <derivativeTransaction>
 *       - (similaire structure)
 */
function parseForm4XML(xmlContent: string): InsiderTransaction[] {
  const transactions: InsiderTransaction[] = [];
  
  try {
    // Gérer les namespaces XML (ex: <edgar:rptOwnerName> ou <rptOwnerName>)
    // Supprimer les namespaces pour simplifier le parsing
    const xmlWithoutNamespaces = xmlContent.replace(/<(\/?)([^:>]+):([^>]+)>/g, '<$1$3>');
    
    // Extraire le nom du reporting owner
    // Format moderne: <rptOwnerName>Tsao David</rptOwnerName> (pas de <value> pour le nom)
    let ownerNameMatch = xmlWithoutNamespaces.match(/<rptOwnerName[^>]*>([^<]+)<\/rptOwnerName>/i);
    if (!ownerNameMatch) {
      ownerNameMatch = xmlContent.match(/<rptOwnerName[^>]*>([^<]+)<\/rptOwnerName>/i);
    }
    const ownerName = ownerNameMatch ? ownerNameMatch[1].trim() : 'Unknown';
    
    // Extraire le CIK du reporting owner
    // Format moderne: <rptOwnerCik>0002087127</rptOwnerCik> (pas de <value> pour le CIK)
    let ownerCikMatch = xmlWithoutNamespaces.match(/<rptOwnerCik[^>]*>([^<]+)<\/rptOwnerCik>/i);
    if (!ownerCikMatch) {
      ownerCikMatch = xmlContent.match(/<rptOwnerCik[^>]*>([^<]+)<\/rptOwnerCik>/i);
    }
    const ownerCik = ownerCikMatch ? ownerCikMatch[1].trim().padStart(10, '0') : undefined;

    console.log(`[Form4 Parser] Parsing XML - Owner: ${ownerName}, CIK: ${ownerCik}`);

    // Parser les transactions non-dérivatives (stocks directs)
    // Chercher dans le XML avec et sans namespaces
    const nonDerivativePattern = /<nonDerivativeTransaction[^>]*>([\s\S]*?)<\/nonDerivativeTransaction>/gi;
    const nonDerivativeMatches = Array.from(xmlWithoutNamespaces.matchAll(nonDerivativePattern));
    console.log(`[Form4 Parser] Found ${nonDerivativeMatches.length} non-derivative transactions`);
    
    for (const match of nonDerivativeMatches) {
      const transactionXml = match[1];
      const transaction = parseTransactionBlock(transactionXml, ownerName, ownerCik, 'stock');
      if (transaction) {
        transactions.push(transaction);
      } else {
        console.warn(`[Form4 Parser] Failed to parse non-derivative transaction block`);
      }
    }

    // Parser les transactions dérivatives (options, etc.)
    const derivativePattern = /<derivativeTransaction[^>]*>([\s\S]*?)<\/derivativeTransaction>/gi;
    const derivativeMatches = Array.from(xmlWithoutNamespaces.matchAll(derivativePattern));
    console.log(`[Form4 Parser] Found ${derivativeMatches.length} derivative transactions`);
    
    for (const match of derivativeMatches) {
      const transactionXml = match[1];
      const transaction = parseTransactionBlock(transactionXml, ownerName, ownerCik, 'derivative');
      if (transaction) {
        transactions.push(transaction);
      } else {
        console.warn(`[Form4 Parser] Failed to parse derivative transaction block`);
      }
    }
    
    console.log(`[Form4 Parser] Total transactions extracted: ${transactions.length}`);
    
    // Si aucune transaction trouvée, logger un échantillon du XML pour diagnostic
    if (transactions.length === 0) {
      const xmlSample = xmlContent.substring(0, 1000);
      console.warn(`[Form4 Parser] No transactions found. XML sample (first 1000 chars):`);
      console.warn(xmlSample);
    }

    // Extraire la relation (CEO, CFO, etc.) depuis le reportingOwner
    // Format moderne: <officerTitle>Chief Technology Officer</officerTitle>
    let relationMatch = xmlWithoutNamespaces.match(/<officerTitle[^>]*>([^<]+)<\/officerTitle>/i);
    if (!relationMatch) {
      relationMatch = xmlContent.match(/<officerTitle[^>]*>([^<]+)<\/officerTitle>/i);
    }
    if (!relationMatch) {
      relationMatch = xmlContent.match(/<directorTitle[^>]*>([^<]+)<\/directorTitle>/i);
    }
    
    const relation = relationMatch ? relationMatch[1].trim() : 'Unknown';

    // Mettre à jour la relation pour toutes les transactions
    // Décoder les entités HTML (&amp; -> &, etc.)
    const cleanRelation = relation
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    
    transactions.forEach(t => {
      if (t.relation === 'Unknown') {
        t.relation = cleanRelation;
      }
    });

  } catch (error: any) {
    console.error('[Form4 Parser] XML parsing error:', error.message);
  }

  return transactions;
}

/**
 * Parser un bloc de transaction (nonDerivativeTransaction ou derivativeTransaction)
 * 
 * Version robuste qui gère:
 * - Les montants enfouis dans <transactionAmounts>
 * - Les options/derivatives avec underlyingSecurityShares
 * - Les footnotes et structures XML complexes
 */
function parseTransactionBlock(
  transactionXml: string,
  ownerName: string,
  ownerCik: string | undefined,
  type: 'stock' | 'derivative'
): InsiderTransaction | null {
  try {
    // 1. Nettoyage des namespaces pour simplifier les Regex
    const cleanXml = transactionXml.replace(/<(\/?)([^:>]+):([^>]+)>/g, '<$1$3>');
    
    // 2. Helper ultra-robuste pour extraire une valeur numérique
    // Cette regex cherche la balise, ignore les <value> optionnels et capture le chiffre
    // Elle gère aussi les espaces et les nouvelles lignes \s*
    const extractNumeric = (tag: string): number => {
      const regex = new RegExp(`<${tag}[^>]*>(?:\\s*<value>)?\\s*([^<\\s]+)\\s*(?:<\\/value>)?\\s*<\\/${tag}>`, 'i');
      const match = cleanXml.match(regex);
      if (match) {
        const val = match[1].replace(/,/g, ''); // Enlever les virgules américaines
        return parseFloat(val) || 0;
      }
      return 0;
    };

    // 3. Extraction des données
    const transactionDateMatch = cleanXml.match(/<transactionDate[^>]*>(?:\s*<value>)?\s*([^<\s]+)/i);
    const transactionDate = transactionDateMatch ? transactionDateMatch[1] : null;
    
    const transactionCodeMatch = cleanXml.match(/<transactionCode[^>]*>(?:\s*<value>)?\s*([^<\s]+)/i);
    const transactionCode = transactionCodeMatch ? transactionCodeMatch[1] : '';

    // On cherche les shares. Si 0, on regarde si c'est une option (derivative)
    let shares = extractNumeric('transactionShares');
    if (shares === 0 && type === 'derivative') {
      shares = extractNumeric('underlyingSecurityShares');
    }

    const price = extractNumeric('transactionPricePerShare');
    const acquiredDisposedCode = cleanXml.match(/<transactionAcquiredDisposedCode[^>]*>(?:\s*<value>)?\s*([^<\s]+)/i)?.[1];

    // 4. LOGIQUE DE REJET (Le point sensible)
    if (!transactionDate) return null;
    
    // On ne rejette QUE si les shares ET le prix sont à 0 (cas rare des erreurs SEC)
    // Mais on accepte les shares > 0 avec prix 0 (Grants/Cadeaux)
    if (shares === 0) {
      console.warn(`[Form4 Parser] Skipping block: Shares=0. Date: ${transactionDate}`);
      return null;
    }

    // 5. Extraire le titre du security (optionnel)
    const securityTitleMatch = cleanXml.match(/<securityTitle[^>]*>(?:\s*<value>)?\s*([^<]+)/i);
    const securityTitle = securityTitleMatch ? securityTitleMatch[1].trim() : undefined;

    return {
      insider_name: ownerName,
      insider_cik: ownerCik,
      relation: 'Unknown', 
      transaction_type: mapTransactionCode(transactionCode),
      shares: Math.abs(shares),
      price_per_share: price,
      total_value: Math.abs(shares * price),
      transaction_date: validateAndFormatDate(transactionDate),
      security_title: securityTitle,
      ownership_nature: acquiredDisposedCode === 'A' ? 'Direct' : 'Indirect',
    };
  } catch (error: any) {
    console.error('[Form4 Parser] Error parsing transaction block:', error.message);
    console.error('[Form4 Parser] Transaction XML snippet:', transactionXml.substring(0, 200));
    return null;
  }
}

/**
 * Mapper les codes de transaction SEC vers des types lisibles
 * 
 * Codes SEC officiels (selon https://www.sec.gov/edgar/searchedgar/ownershipformcodes.html):
 * 
 * SIGNAL FORT (Smart Money - mouvements volontaires):
 * - P = Purchase (ACHAT OPEN MARKET - Signal ++++)
 * - S = Sale (VENTE OPEN MARKET - Signal -)
 * 
 * SIGNAL MOYEN (Exercices/Conversions):
 * - M = Exercise (Exercice d'options - Signal neutre)
 * - C = Conversion (Conversion d'un titre dérivé - Signal neutre)
 * 
 * SIGNAL FAIBLE (Mouvements automatiques/administratifs):
 * - A = Grant (Attribution gratuite - Signal neutre)
 * - D = Disposition (Disposition à l'émetteur - Signal nul)
 * - F = Payment (Paiement d'exercice - Signal nul)
 * - I = Discretionary (Transaction discrétionnaire - Signal variable)
 * - X = Exercise OTM (Exercice d'options OTM - Signal nul)
 * - G = Gift (Don - Signal nul)
 * - J = Other (Autre - Souvent transfert de trust - Signal nul)
 */
function mapTransactionCode(code: string): string {
  const mapping: Record<string, string> = {
    'P': 'Purchase',      // Achat Open Market (LE SEUL VRAI SIGNAL)
    'S': 'Sale',          // Vente Open Market
    'M': 'Exercise',      // Conversion d'options en actions
    'C': 'Conversion',    // Conversion d'un titre dérivé
    'A': 'Grant',         // Actions gratuites données par la boîte
    'G': 'Gift',          // Cadeau (Donation)
    'F': 'Tax Payment',   // Vente forcée pour payer les impôts
    'J': 'Other'          // Mouvements divers (souvent trusts)
  };
  return mapping[code.toUpperCase()] || `Other (${code})`;
}

/**
 * Validation stricte de la date pour éviter le bug de 1975
 * 
 * Le problème précédent : La regex /[^0-9]/g extrait tous les chiffres,
 * ce qui peut créer des dates invalides si elle reçoit un CIK ou un timestamp.
 */
function validateAndFormatDate(dateStr: string): string {
  if (!dateStr || !dateStr.trim()) {
    console.warn(`[Form4 Parser] validateAndFormatDate: Empty date string, using current date`);
    return new Date().toISOString().split('T')[0];
  }
  
  const trimmed = dateStr.trim();
  
  // Regex pour format YYYY-MM-DD (format standard SEC)
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    
    // Validation stricte : année entre 1995 et 2028 (dates raisonnables pour Form 4)
    if (year < 1995 || year > 2028) {
      console.warn(`[Form4 Parser] validateAndFormatDate: Year ${year} is out of range (1995-2028), using current date`);
      return new Date().toISOString().split('T')[0];
    }
    
    // Validation que c'est une date valide
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return match[0]; // Retourner YYYY-MM-DD
    } else {
      console.warn(`[Form4 Parser] validateAndFormatDate: Invalid date components (${year}-${month}-${day}), using current date`);
      return new Date().toISOString().split('T')[0];
    }
  }
  
  // Si format ISO (YYYY-MM-DDTHH:mm:ss), extraire la date
  const isoMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) {
    return validateAndFormatDate(isoMatch[1]); // Réutiliser la validation
  }
  
  // Dernier fallback: date actuelle
  console.warn(`[Form4 Parser] validateAndFormatDate: Could not parse date "${dateStr}", using current date`);
  return new Date().toISOString().split('T')[0];
}

/**
 * Insérer les transactions insider dans S3
 */
/**
 * Normaliser le type de transaction pour la base de données
 * Purchase -> buy, Sale -> sell, etc.
 */
function normalizeTransactionType(type: string): string {
  if (!type || !type.trim()) {
    return 'other';
  }
  
  const normalized = type.toLowerCase().trim();
  
  // Si c'est déjà normalisé (buy, sell), retourner tel quel
  if (normalized === 'buy' || normalized === 'sell') {
    return normalized;
  }
  
  // Mapper depuis les valeurs Form 4 (Purchase, Sale, etc.)
  const typeMap: Record<string, string> = {
    'purchase': 'buy',
    'sale': 'sell',
    'exercise': 'exercise',
    'grant': 'grant',
    'conversion': 'conversion',
    'payment': 'payment',
    'gift': 'gift',
    'disposition': 'disposition',
    'discretionary': 'discretionary',
    'other': 'other',
    // Gérer aussi les codes bruts si jamais ils passent
    'p': 'buy',
    's': 'sell',
    'm': 'exercise',
    'c': 'conversion',
    'a': 'grant',
    'd': 'disposition',
    'f': 'payment',
    'g': 'gift',
    'j': 'other',
  };
  
  // Mapper depuis les valeurs Form 4
  return typeMap[normalized] || 'other';
}

async function insertInsiderTransactions(
  companyId: number,
  filingId: number,
  transactions: InsiderTransaction[]
): Promise<void> {
  const toInsert = transactions.map(t => ({
    company_id: companyId,
    filing_id: filingId,
    insider_name: t.insider_name,
    insider_cik: t.insider_cik, // CIK du dirigeant
    insider_title: t.relation, // Utiliser relation comme title
    relation: t.relation,
    transaction_type: normalizeTransactionType(t.transaction_type),
    shares: t.shares,
    price_per_share: t.price_per_share,
    total_value: t.total_value,
    transaction_date: t.transaction_date,
    alert_flag: t.total_value > 1000000, // Alerte si > 1M$
  }));

  // Insérer sur S3
  console.log(`[Form4 Parser] Writing ${toInsert.length} transactions to S3...`);
  try {
    const result = await insertRowsS3('insider_trades', toInsert);
    console.log(`[Form4 Parser] ✅ Successfully wrote to S3: ${result.s3Key}`);
  } catch (error: any) {
    console.error(`[Form4 Parser] ❌ Error writing to S3:`, error.message);
    console.error(error);
    throw error;
  }

  // Filtrer et insérer les "Top Signals" (Golden Filter)
  try {
    const topSignals = filterTopSignals(toInsert);
    if (topSignals.length > 0) {
      await insertTopSignals(topSignals);
      console.log(`[Form4 Parser] ✅ Filtered ${topSignals.length} top signals from ${toInsert.length} transactions`);

      // Envoyer des alertes si configuré
      const alertConfig = {
        discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL,
        telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
        telegramChatId: process.env.TELEGRAM_CHAT_ID,
      };

      if (alertConfig.discordWebhookUrl || (alertConfig.telegramBotToken && alertConfig.telegramChatId)) {
        try {
          // Enrichir les signals avec les infos de company (pour l'affichage)
          const enrichedSignals = topSignals.map(signal => ({
            ...signal,
            ticker: undefined, // Sera enrichi plus tard si nécessaire
            company_name: undefined,
            accession_number: undefined,
          }));

          const result = await alertTopSignals(enrichedSignals, alertConfig);
          console.log(`[Form4 Parser] ✅ Sent ${result.sent} alerts (${result.failed} failed)`);
        } catch (error: any) {
          console.error(`[Form4 Parser] ⚠️ Error sending alerts:`, error.message);
          // Ne pas faire échouer l'insertion si les alertes échouent
        }
      }
    }
  } catch (error: any) {
    // Ne pas faire échouer l'insertion principale si le filtrage échoue
    console.error(`[Form4 Parser] ⚠️ Error filtering top signals:`, error.message);
  }

  // Créer des alertes pour les transactions > 1M$
  const largeTransactions = toInsert.filter(t => t.total_value > 1000000);
  if (largeTransactions.length > 0) {
    try {
      const alerts = largeTransactions.map(t => ({
        alert_type: 'insider_large',
        company_id: companyId,
        filing_id: filingId,
        title: 'Large Insider Transaction',
        description: `${t.insider_name} (${t.relation}) - ${t.transaction_type}: $${t.total_value}`,
        transaction_value: t.total_value,
        threshold_value: 1000000,
        severity: t.total_value > 10000000 ? 'critical' : t.total_value > 5000000 ? 'high' : 'medium',
        status: 'new',
      }));
      await insertRowsS3('transaction_alerts', alerts);
      console.log(`[Form4 Parser] Created ${alerts.length} alerts for large transactions`);
    } catch (error: any) {
      // Ne pas faire échouer l'insertion principale si les alertes échouent
      console.warn(`[Form4 Parser] Failed to create alerts:`, error.message);
    }
  }

  console.log(`[Form4 Parser] Inserted ${toInsert.length} insider transactions for company ${companyId}`);
}

/**
 * Parser un Form 4 depuis une URL SEC
 * 
 * Utilise le champ primaryDocument depuis l'API submissions de la SEC
 * Format: https://www.sec.gov/Archives/edgar/data/{CIK}/{AccNumSansTirets}/{primaryDocument}
 */
export async function parseForm4FromUrl(
  companyId: number,
  filingId: number,
  accessionNumber: string,
  cik: string,
  primaryDocument?: string
): Promise<InsiderTransaction[]> {
  // IMPORTANT: La SEC EDGAR nécessite le CIK avec les zéros initiaux (10 chiffres)
  // Exemple: 0001127602 (pas 1127602)
  const cikPadded = cik.padStart(10, '0'); // S'assurer que le CIK a 10 chiffres avec zéros initiaux
  const accessionClean = accessionNumber.replace(/-/g, ''); // Enlever les tirets pour le chemin
  
  // PRIORITÉ ABSOLUE: Le fichier .txt contient toujours le XML brut et fonctionne mieux
  // Pas besoin d'essayer les fichiers HTML/XML formatés si on a le .txt
  const txtUrl = `${SEC_EDGAR_BASE_URL}/Archives/edgar/data/${cikPadded}/${accessionClean}/${accessionNumber}.txt`;
  console.log(`[Form4 Parser] Using TXT file (contains raw XML): ${txtUrl}`);
  try {
    const transactions = await parseForm4(companyId, filingId, txtUrl, accessionNumber);
    if (transactions.length > 0) {
      return transactions;
    }
  } catch (error: any) {
    console.error(`[Form4 Parser] Failed to parse TXT file:`, error.message);
    // Si le .txt échoue, essayer les fallbacks (peu probable)
  }
  
  // Fallback: Essayer d'autres formats seulement si le .txt échoue
  const possibleUrls = [
    // Format avec xslF345X05/form4.xml (format moderne)
    `${SEC_EDGAR_BASE_URL}/Archives/edgar/data/${cikPadded}/${accessionClean}/xslF345X05/form4.xml`,
    // Format avec xslF345X04/form4.xml (format précédent)
    `${SEC_EDGAR_BASE_URL}/Archives/edgar/data/${cikPadded}/${accessionClean}/xslF345X04/form4.xml`,
    // Format avec xslF345X03/form4.xml (ancien format)
    `${SEC_EDGAR_BASE_URL}/Archives/edgar/data/${cikPadded}/${accessionClean}/xslF345X03/form4.xml`,
    // Format alternatif avec primarydocument.xml
    `${SEC_EDGAR_BASE_URL}/Archives/edgar/data/${cikPadded}/${accessionClean}/primarydocument.xml`,
  ];

  for (const url of possibleUrls) {
    try {
      const transactions = await parseForm4(companyId, filingId, url, accessionNumber);
      if (transactions.length > 0) {
        return transactions;
      }
    } catch (error: any) {
      console.log(`[Form4 Parser] Failed to parse ${url}, trying next...`);
      continue;
    }
  }

  throw new Error(`Failed to parse Form 4 from any URL for ${accessionNumber}`);
}

