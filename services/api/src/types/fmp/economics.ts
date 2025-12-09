/**
 * Types pour les endpoints Economics de FMP
 */

// ========== Treasury Rates ==========

export interface TreasuryRatesQueryParams {
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
}

export interface TreasuryRates {
  date: string;
  month1: number;
  month2: number;
  month3: number;
  month6: number;
  year1: number;
  year2: number;
  year3: number;
  year5: number;
  year7: number;
  year10: number;
  year20: number;
  year30: number;
}

export type TreasuryRatesResponse = TreasuryRates[];

// ========== Economic Indicators ==========

export interface EconomicIndicatorsQueryParams {
  name: string; // Required: GDP, realGDP, nominalPotentialGDP, realGDPPerCapita, federalFunds, CPI, inflationRate, inflation, retailSales, consumerSentiment, durableGoods, unemploymentRate, totalNonfarmPayroll, initialClaims, industrialProductionTotalIndex, newPrivatelyOwnedHousingUnitsStartedTotalUnits, totalVehicleSales, retailMoneyFunds, smoothedUSRecessionProbabilities, 3MonthOr90DayRatesAndYieldsCertificatesOfDeposit, commercialBankInterestRateOnCreditCardPlansAllAccounts, 30YearFixedRateMortgageAverage, 15YearFixedRateMortgageAverage
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
}

export interface EconomicIndicator {
  name: string;
  date: string;
  value: number;
}

export type EconomicIndicatorsResponse = EconomicIndicator[];

// ========== Economic Data Releases Calendar ==========

export interface EconomicCalendarQueryParams {
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
}

export interface EconomicCalendarEvent {
  date: string; // YYYY-MM-DD HH:MM:SS
  country: string;
  event: string;
  currency: string;
  previous: number | null;
  estimate: number | null;
  actual: number | null;
  change: number | null;
  impact: string; // e.g., "Low", "Medium", "High", "None"
  changePercentage: number | null;
  unit: string | null; // e.g., "%", "B", "M", null
}

export type EconomicCalendarResponse = EconomicCalendarEvent[];

// ========== Market Risk Premium ==========

export interface MarketRiskPremium {
  country: string;
  continent: string;
  countryRiskPremium: number;
  totalEquityRiskPremium: number;
}

export type MarketRiskPremiumResponse = MarketRiskPremium[];

