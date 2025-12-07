/**
 * Types pour l'API d'insights agrégés d'un ticker
 * Combine les données de FMP et Unusual Whales pour donner une vue complète
 */

export interface TickerInsightsResponse {
  success: boolean;
  data: TickerInsights;
  cached: boolean;
  timestamp: string;
}

export interface TickerInsights {
  // Informations de base
  ticker: string;
  companyInfo: CompanyInfo;
  quote: QuoteInfo;
  
  // Options & Flow
  optionsFlow: OptionsFlowInsights;
  
  // Activité institutionnelle
  institutionalActivity: InstitutionalInsights;
  
  // Activité des insiders
  insiderActivity: InsiderInsights;
  
  // Dark Pool
  darkPool: DarkPoolInsights;
  
  // Earnings & Financials
  earnings: EarningsInsights;
  
  // Actualités & Événements
  news: NewsInsights;
  
  // Événements économiques
  economicEvents: EconomicEvent[];
  
  // Short Interest
  shortInterest: ShortInterestInfo;
  
  // Métriques financières
  financialMetrics: FinancialMetrics;
  
  // SEC Filings récents
  recentFilings: SECFiling[];
  
  // Signaux d'alerte
  alerts: AlertSignal[];
}

export interface CompanyInfo {
  name: string;
  sector?: string;
  industry?: string;
  exchange: string;
  marketCap?: number;
  description?: string;
  website?: string;
  ceo?: string;
}

export interface QuoteInfo {
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  avgVolume?: number;
  dayLow: number;
  dayHigh: number;
  yearLow: number;
  yearHigh: number;
  previousClose: number;
  open: number;
  timestamp: string;
}

export interface OptionsFlowInsights {
  // Flow récent
  recentFlow: {
    totalAlerts: number;
    callVolume: number;
    putVolume: number;
    callPremium: number;
    putPremium: number;
    putCallRatio: number;
    unusualActivity: number; // Nombre d'activités inhabituelles
  };
  
  // Flow par expiry
  flowByExpiry: Array<{
    expiry: string;
    callVolume: number;
    putVolume: number;
    openInterest: number;
    maxPain?: number;
  }>;
  
  // Activités inhabituelles récentes
  unusualActivity: Array<{
    timestamp: string;
    type: 'sweep' | 'block' | 'large' | 'unusual';
    strike: number;
    expiry: string;
    premium: number;
    volume: number;
    description: string;
  }>;
  
  // Greeks
  greeks?: {
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
    iv: number; // Implied Volatility
  };
  
  // Max Pain (prix où le maximum de perte pour les vendeurs d'options)
  maxPain?: {
    price: number;
    expiry?: string;
  };
  
  // Open Interest Change (changement d'intérêt ouvert)
  oiChange?: {
    totalChange: number;
    callChange: number;
    putChange: number;
    netChange: number;
  };
  
  // Options Volume (volumes d'options)
  optionsVolume?: {
    totalVolume: number;
    callVolume: number;
    putVolume: number;
    volumeRatio: number; // put/call ratio
  };
  
  // Spot GEX Exposures (expositions gamma)
  spotGEX?: {
    totalGEX: number;
    callGEX: number;
    putGEX: number;
    netGEX: number;
  };
}

export interface InstitutionalInsights {
  // Holdings
  topHolders: Array<{
    name: string;
    shares: number;
    value: number;
    percentage: number;
    isHedgeFund: boolean;
    change?: number; // Changement depuis dernier filing
  }>;
  
  // Activité récente
  recentActivity: Array<{
    institutionName: string;
    transactionType: 'BUY' | 'SELL';
    shares: number;
    value: number;
    date: string;
    price: number;
    volume?: number; // Volume de la transaction
    cik?: string; // CIK de l'institution
  }>;
  
  // Statistiques
  stats: {
    totalInstitutions: number;
    totalHedgeFunds: number;
    totalShares: number;
    totalValue: number;
    netActivity: number; // Net buys - sells (count)
    // Statistiques de volume et valeur
    totalBuyVolume?: number; // Total des volumes d'achat
    totalSellVolume?: number; // Total des volumes de vente
    totalBuyValue?: number; // Total des valeurs d'achat
    totalSellValue?: number; // Total des valeurs de vente
    netVolume?: number; // Net volume (buy - sell)
    netValue?: number; // Net value (buy - sell)
  };
}

export interface InsiderInsights {
  // Transactions récentes
  recentTransactions: Array<{
    ownerName: string;
    title: string;
    transactionType: string;
    shares: number;
    price: number;
    value: number;
    date: string;
  }>;
  
  // Statistiques
  stats: {
    totalTransactions: number;
    buys: number;
    sells: number;
    netActivity: number;
    totalValue: number;
  };
}

export interface DarkPoolInsights {
  // Trades récents
  recentTrades: Array<{
    date: string;
    volume: number;
    price: number;
    value: number;
  }>;
  
  // Statistiques
  stats: {
    totalTrades: number;
    totalVolume: number;
    avgPrice: number;
    largestTrade: number;
  };
}

export interface EarningsInsights {
  // Prochain earnings
  upcoming?: {
    date: string;
    estimatedEPS?: number;
    estimatedRevenue?: number;
    time: 'before_market' | 'after_market';
  };
  
  // Derniers earnings
  last?: {
    date: string;
    eps: number;
    estimatedEPS?: number;
    revenue: number;
    estimatedRevenue?: number;
    surprise?: number;
    surprisePercent?: number;
  };
  
  // Historique
  history: Array<{
    date: string;
    eps: number;
    revenue: number;
    surprise?: number;
  }>;
}

export interface NewsInsights {
  // Actualités récentes
  recent: Array<{
    title: string;
    publishedDate: string;
    url: string;
    source: string;
    summary?: string;
    sentiment?: 'positive' | 'negative' | 'neutral';
  }>;
  
  // Statistiques
  stats: {
    totalNews: number;
    last24h: number;
    last7d: number;
  };
}

export interface EconomicEvent {
  date: string;
  event: string;
  country: string;
  currency: string;
  impact: 'low' | 'medium' | 'high';
  previous?: number;
  estimate?: number;
  actual?: number;
}

export interface ShortInterestInfo {
  shortInterest?: number;
  shortRatio?: number;
  daysToCover?: number;
  shortPercentOfFloat?: number;
  lastUpdated: string;
}

export interface FinancialMetrics {
  // Key Metrics
  keyMetrics?: {
    peRatio?: number;
    priceToBook?: number;
    evToRevenue?: number;
    evToEbitda?: number;
    debtToEquity?: number;
    currentRatio?: number;
    returnOnEquity?: number;
    returnOnAssets?: number;
  };
  
  // Financial Ratios
  ratios?: {
    currentRatio?: number;
    quickRatio?: number;
    debtToEquity?: number;
    debtToAssets?: number;
    interestCoverage?: number;
    grossProfitMargin?: number;
    operatingProfitMargin?: number;
    netProfitMargin?: number;
  };
  
  // Growth
  growth?: {
    revenueGrowth?: number;
    earningsGrowth?: number;
    epsGrowth?: number;
  };
}

export interface SECFiling {
  date: string;
  formType: string; // '8-K', '13F-HR', '10-K', '10-Q', '4', etc.
  title: string;
  url: string;
  hasFinancials: boolean;
  cik?: string; // CIK de l'entreprise
  accessionNumber?: string; // Numéro d'accession SEC
  description?: string; // Description du filing
}

export interface AlertSignal {
  type: 'unusual_volume' | 'institutional_activity' | 'insider_trade' | 'earnings_soon' | 'news_event' | 'options_flow';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: string;
  data?: Record<string, any>;
}

