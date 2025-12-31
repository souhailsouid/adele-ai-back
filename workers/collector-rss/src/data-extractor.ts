/**
 * Service d'extraction de données structurées depuis les news RSS
 * Extrait les valeurs, prévisions, comparaisons pour générer des signaux "Surprise"
 * 
 * Exemples :
 * - "Tokyo area December core CPI +2.3% year on year government according to source poll +2.5%"
 *   → actual: 2.3%, forecast: 2.5%, surprise: negative
 * 
 * - "US GDP QoQ Advance Actual 4.3% (Forecast 3.3%, Previous 3.8%)"
 *   → actual: 4.3%, forecast: 3.3%, previous: 3.8%, surprise: positive
 */

export interface ExtractedData {
  // Valeurs extraites
  actual?: number;
  forecast?: number;
  previous?: number;
  
  // Type de données
  dataType?: 'inflation' | 'gdp' | 'employment' | 'retail_sales' | 'industrial_production' | 'other';
  indicator?: string; // 'CPI', 'GDP', 'NFP', etc.
  
  // Calcul de surprise
  surprise?: 'positive' | 'negative' | 'neutral';
  surpriseMagnitude?: number; // Différence en points de pourcentage
  
  // Métadonnées
  unit?: 'percent' | 'absolute' | 'index';
  period?: string; // 'monthly', 'quarterly', 'yearly'
  region?: string; // 'US', 'JP', 'EU', etc.
}

/**
 * Extraire les données structurées depuis un titre/description de news
 */
export function extractStructuredData(title: string, description: string = ""): ExtractedData | null {
  const text = `${title} ${description}`.toLowerCase();
  
  // Patterns pour différents types d'indicateurs
  const patterns = {
    // CPI / Inflation
    cpi: {
      regex: /(?:cpi|consumer price index|inflation).*?([+-]?\d+\.?\d*)\s*%.*?(?:forecast|poll|expected).*?([+-]?\d+\.?\d*)\s*%/i,
      dataType: 'inflation' as const,
      indicator: 'CPI',
    },
    // GDP
    gdp: {
      regex: /(?:gdp|gross domestic product).*?actual\s+([+-]?\d+\.?\d*)\s*%.*?(?:forecast|expected).*?([+-]?\d+\.?\d*)\s*%/i,
      dataType: 'gdp' as const,
      indicator: 'GDP',
    },
    // Employment / NFP
    employment: {
      regex: /(?:nonfarm payrolls|nfp|employment|unemployment|jobless claims).*?actual\s+([+-]?\d+\.?\d*).*?(?:forecast|expected).*?([+-]?\d+\.?\d*)/i,
      dataType: 'employment' as const,
      indicator: 'NFP',
    },
    // Retail Sales
    retail: {
      regex: /retail sales.*?actual\s+([+-]?\d+\.?\d*)\s*%.*?(?:forecast|expected).*?([+-]?\d+\.?\d*)\s*%/i,
      dataType: 'retail_sales' as const,
      indicator: 'Retail Sales',
    },
    // Industrial Production
    industrial: {
      regex: /industrial production.*?actual\s+([+-]?\d+\.?\d*)\s*%.*?(?:forecast|expected).*?([+-]?\d+\.?\d*)\s*%/i,
      dataType: 'industrial_production' as const,
      indicator: 'Industrial Production',
    },
  };

  // Chercher un match pour chaque pattern
  for (const [key, pattern] of Object.entries(patterns)) {
    const match = text.match(pattern.regex);
    if (match) {
      const actual = parseFloat(match[1]);
      const forecast = match[2] ? parseFloat(match[2]) : undefined;
      
      // Extraire previous si disponible
      const previousMatch = text.match(/previous\s+([+-]?\d+\.?\d*)\s*%/i);
      const previous = previousMatch ? parseFloat(previousMatch[1]) : undefined;
      
      // Calculer la surprise
      let surprise: 'positive' | 'negative' | 'neutral' | undefined;
      let surpriseMagnitude: number | undefined;
      
      if (forecast !== undefined && !isNaN(actual) && !isNaN(forecast)) {
        const diff = actual - forecast;
        surpriseMagnitude = Math.abs(diff);
        
        if (diff > 0.1) {
          surprise = 'positive'; // Actual > Forecast
        } else if (diff < -0.1) {
          surprise = 'negative'; // Actual < Forecast
        } else {
          surprise = 'neutral'; // Proche de la prévision
        }
      }
      
      // Extraire la région
      let region: string | undefined;
      if (text.includes('tokyo') || text.includes('japan')) region = 'JP';
      else if (text.includes('us') || text.includes('united states')) region = 'US';
      else if (text.includes('euro') || text.includes('ecb')) region = 'EU';
      else if (text.includes('china')) region = 'CN';
      
      // Extraire la période
      let period: string | undefined;
      if (text.includes('month') || text.includes('mom')) period = 'monthly';
      else if (text.includes('quarter') || text.includes('qoq')) period = 'quarterly';
      else if (text.includes('year') || text.includes('yoy')) period = 'yearly';
      
      return {
        actual,
        forecast,
        previous,
        dataType: pattern.dataType,
        indicator: pattern.indicator,
        surprise,
        surpriseMagnitude,
        unit: 'percent',
        period,
        region,
      };
    }
  }
  
  // Pattern générique pour "Actual X (Forecast Y, Previous Z)"
  const genericPattern = /actual\s+([+-]?\d+\.?\d*)\s*%.*?(?:forecast|expected)\s+([+-]?\d+\.?\d*)\s*%.*?(?:previous)\s+([+-]?\d+\.?\d*)\s*%/i;
  const genericMatch = text.match(genericPattern);
  
  if (genericMatch) {
    const actual = parseFloat(genericMatch[1]);
    const forecast = parseFloat(genericMatch[2]);
    const previous = parseFloat(genericMatch[3]);
    
    let surprise: 'positive' | 'negative' | 'neutral' | undefined;
    let surpriseMagnitude: number | undefined;
    
    if (!isNaN(actual) && !isNaN(forecast)) {
      const diff = actual - forecast;
      surpriseMagnitude = Math.abs(diff);
      
      if (diff > 0.1) {
        surprise = 'positive';
      } else if (diff < -0.1) {
        surprise = 'negative';
      } else {
        surprise = 'neutral';
      }
    }
    
    return {
      actual,
      forecast,
      previous,
      dataType: 'other',
      surprise,
      surpriseMagnitude,
      unit: 'percent',
    };
  }
  
  return null;
}

/**
 * Formater les données extraites pour l'affichage
 */
export function formatExtractedData(data: ExtractedData): string {
  if (!data.actual) return "";
  
  const parts: string[] = [];
  
  if (data.indicator) {
    parts.push(`${data.indicator}:`);
  }
  
  parts.push(`Actual: ${data.actual}%`);
  
  if (data.forecast !== undefined) {
    parts.push(`Forecast: ${data.forecast}%`);
  }
  
  if (data.previous !== undefined) {
    parts.push(`Previous: ${data.previous}%`);
  }
  
  if (data.surprise) {
    const emoji = data.surprise === 'positive' ? '📈' : data.surprise === 'negative' ? '📉' : '➡️';
    parts.push(`${emoji} Surprise: ${data.surprise}`);
    
    if (data.surpriseMagnitude) {
      parts.push(`(${data.surpriseMagnitude.toFixed(2)}pp)`);
    }
  }
  
  return parts.join(' ');
}


