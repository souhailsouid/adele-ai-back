/**
 * SEC API Client avec retry et rate limiting
 * 
 * ⚠️ COST SAFETY: Rate limiting strict (10 req/s max)
 */

const SEC_SUBMISSIONS_API_BASE_URL = 'https://data.sec.gov/submissions';
const USER_AGENT = 'ADEL AI (contact@adel.ai)';
const RATE_LIMIT_DELAY_MS = 120; // 120ms entre requêtes = ~8.3 req/s (sous la limite de 10 req/s)

// Rate limiter global (simple in-memory queue)
// ⚠️ ASSUMPTION: reserved_concurrency = 1 pour cette Lambda
// WHY: Si concurrency > 1, chaque instance Lambda a son propre compteur in-memory
// → Risque de dépasser 10 req/s au global (plusieurs instances en parallèle)
// → Solution future: rate limiter distribué (DynamoDB/Redis) si concurrency > 1
let lastRequestTime = 0;

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Rate limiter: attendre si nécessaire pour respecter 10 req/s
 */
async function rateLimit(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < RATE_LIMIT_DELAY_MS) {
    const waitTime = RATE_LIMIT_DELAY_MS - timeSinceLastRequest;
    await sleep(waitTime);
  }
  
  lastRequestTime = Date.now();
}

/**
 * Retry avec backoff exponentiel + Retry-After header
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Ne pas retry sur 404 (ressource non trouvée)
      if (error.status === 404) {
        throw error;
      }
      
      const status = error?.status;
      // Retry sur erreurs réseau (status undefined), 429 (rate limit) ou 5xx (erreur serveur)
      const shouldRetry = 
        attempt < maxRetries && 
        (status === undefined || status === 429 || (typeof status === 'number' && status >= 500));
      
      if (shouldRetry) {
        // Utiliser Retry-After header si présent (429), sinon backoff exponentiel
        let delayMs = baseDelayMs * Math.pow(2, attempt);
        if (status === 429 && error.retryAfterMs) {
          delayMs = error.retryAfterMs;
        }
        console.warn(`  ⚠️  Retry attempt ${attempt + 1}/${maxRetries} after ${delayMs}ms (status: ${status || 'network error'})`);
        await sleep(delayMs);
        continue;
      }
      
      throw error;
    }
  }
  
  throw lastError || new Error('Unknown error');
}

/**
 * Pad CIK to 10 digits with leading zeros (robuste)
 * 
 * ✅ Gère les espaces, préfixes CIK, et extrait uniquement les chiffres
 */
function padCik(cik: string): string {
  const digits = (cik || '').trim().replace(/^CIK/i, '').replace(/\D/g, '');
  return `CIK${digits.padStart(10, '0')}`;
}

/**
 * Interface pour les submissions SEC
 */
export interface SECSubmission {
  cik: string;
  entityType: string;
  sic: string;
  sicDescription: string;
  insiderTransactionForOwnerExists: number;
  insiderTransactionForIssuerExists: number;
  name: string;
  tickers: string[];
  exchanges: string[];
  ein: string;
  description: string;
  website: string;
  investorWebsite: string;
  category: string;
  fiscalYearEnd: string;
  stateOfIncorporation: string;
  stateOfIncorporationDescription: string;
  addresses: {
    mailing: {
      street1: string;
      street2: string;
      city: string;
      stateOrCountry: string;
      zipCode: string;
      stateOrCountryDescription: string;
    };
    business: {
      street1: string;
      street2: string;
      city: string;
      stateOrCountry: string;
      zipCode: string;
      stateOrCountryDescription: string;
    };
  };
  phone: string;
  flags: string;
  formerNames: Array<{
    name: string;
    from: string;
    to: string;
  }>;
  filings: {
    recent: {
      accessionNumber: string[];
      filingDate: string[];
      reportDate: string[];
      acceptanceDateTime: string[];
      act: string[];
      form: string[];
      fileNumber: string[];
      filmNumber: string[];
      items: string[];
      size: number[];
      isXBRL: number[];
      isInlineXBRL: number[];
      primaryDocument: string[];
      primaryDocDescription: string[];
    };
    files: Array<{
      name: string;
      filingCount: number;
      filingFrom: string;
      filingTo: string;
    }>;
  };
}

/**
 * Récupérer les submissions SEC pour un CIK
 * 
 * @param cik - CIK de l'entreprise (avec ou sans préfixe CIK)
 * @returns Données SEC ou null si non trouvé
 */
export async function fetchSECSubmissions(cik: string): Promise<SECSubmission | null> {
  // Rate limiting
  await rateLimit();
  
  const paddedCik = padCik(cik);
  const url = `${SEC_SUBMISSIONS_API_BASE_URL}/${paddedCik}.json`;
  
  return retryWithBackoff(async () => {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      },
    });
    
    if (response.status === 404) {
      console.warn(`  ⚠️  CIK ${cik} non trouvé sur SEC`);
      return null;
    }
    
    if (!response.ok) {
      const error: any = new Error(`HTTP ${response.status}: ${response.statusText}`);
      error.status = response.status;
      
      // Extraire Retry-After header pour 429
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        if (retryAfter) {
          // Retry-After peut être en secondes (string) ou Date
          const retryAfterSeconds = parseInt(retryAfter, 10);
          if (!isNaN(retryAfterSeconds)) {
            error.retryAfterMs = retryAfterSeconds * 1000;
          }
        }
      }
      
      throw error;
    }
    
    const data = await response.json() as SECSubmission;
    return data;
  });
}

/**
 * Extraire les Form 4 récents depuis les submissions
 * 
 * @param submissions - Données SEC submissions
 * @param maxCount - Nombre maximum de Form 4 à retourner (défaut: 20)
 * @returns Liste des Form 4 (accessionNumber, filingDate, reportDate, primaryDocument)
 */
export function extractForm4Filings(
  submissions: SECSubmission,
  maxCount: number = 20
): Array<{
  accessionNumber: string;
  filingDate: string;
  reportDate: string;
  primaryDocument: string;
}> {
  const filings: Array<{
    accessionNumber: string;
    filingDate: string;
    reportDate: string;
    primaryDocument: string;
  }> = [];
  
  const recent = submissions.filings?.recent;
  if (!recent) {
    return filings;
  }
  
  const forms = recent.form || [];
  const accessionNumbers = recent.accessionNumber || [];
  const filingDates = recent.filingDate || [];
  const reportDates = recent.reportDate || [];
  const primaryDocuments = recent.primaryDocument || [];
  
  for (let i = 0; i < forms.length && filings.length < maxCount; i++) {
    if (forms[i] === '4') {
      const accession = accessionNumbers[i];
      const doc = primaryDocuments[i];
      
      // ⚠️ Skip si accessionNumber ou primaryDocument manquant (évite junk data)
      if (!accession || !doc) {
        continue;
      }
      
      filings.push({
        accessionNumber: accession,
        filingDate: filingDates[i] || '',
        reportDate: reportDates[i] || '',
        primaryDocument: doc,
      });
    }
  }
  
  return filings;
}

/**
 * Récupérer un document SEC (XML, HTML, etc.) depuis l'URL complète
 * 
 * ⚠️ COST SAFETY: Rate limiting strict (120ms entre requêtes)
 * 
 * @param url - URL complète du document SEC (ex: https://www.sec.gov/Archives/edgar/data/...)
 * @returns Contenu du document (string) ou null si non trouvé
 */
export async function fetchSECDocument(url: string): Promise<string | null> {
  // Rate limiting
  await rateLimit();
  
  return retryWithBackoff(async () => {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': '*/*',
      },
    });
    
    if (response.status === 404) {
      console.warn(`  ⚠️  Document non trouvé: ${url}`);
      return null;
    }
    
    if (!response.ok) {
      const error: any = new Error(`HTTP ${response.status}: ${response.statusText}`);
      error.status = response.status;
      
      // Extraire Retry-After header pour 429
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        if (retryAfter) {
          const retryAfterSeconds = parseInt(retryAfter, 10);
          if (!isNaN(retryAfterSeconds)) {
            error.retryAfterMs = retryAfterSeconds * 1000;
          }
        }
      }
      
      throw error;
    }
    
    const text = await response.text();
    return text;
  });
}
