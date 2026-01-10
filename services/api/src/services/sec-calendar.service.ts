/**
 * Service de calendrier des publications SEC
 * Gère les périodes de pic pour les filings 13F
 */

export interface QuarterInfo {
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  endDate: string; // Date de fin du trimestre (YYYY-MM-DD)
  deadlineDate: string; // Date limite de publication (45 jours après)
  peakStartDate: string; // Début de la période de pic (1er du mois)
  peakEndDate: string; // Fin de la période de pic (15 du mois)
  year: number;
}

/**
 * Calcule les informations du trimestre actuel
 */
export function getCurrentQuarter(): QuarterInfo {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12
  const day = now.getDate();

  // Déterminer le trimestre
  let quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  let endDate: Date;
  let deadlineDate: Date;
  let peakStartDate: Date;
  let peakEndDate: Date;

  if (month <= 3) {
    // Q1 (finit le 31 mars)
    quarter = 'Q1';
    endDate = new Date(year, 2, 31); // 31 mars
    deadlineDate = new Date(year, 4, 15); // 15 mai (45 jours après)
    peakStartDate = new Date(year, 4, 1); // 1er mai
    peakEndDate = new Date(year, 4, 15); // 15 mai
  } else if (month <= 6) {
    // Q2 (finit le 30 juin)
    quarter = 'Q2';
    endDate = new Date(year, 5, 30); // 30 juin
    deadlineDate = new Date(year, 7, 14); // 14 août
    peakStartDate = new Date(year, 7, 1); // 1er août
    peakEndDate = new Date(year, 7, 14); // 14 août
  } else if (month <= 9) {
    // Q3 (finit le 30 septembre)
    quarter = 'Q3';
    endDate = new Date(year, 8, 30); // 30 septembre
    deadlineDate = new Date(year, 10, 14); // 14 novembre
    peakStartDate = new Date(year, 10, 1); // 1er novembre
    peakEndDate = new Date(year, 10, 14); // 14 novembre
  } else {
    // Q4 (finit le 31 décembre)
    quarter = 'Q4';
    endDate = new Date(year, 11, 31); // 31 décembre
    deadlineDate = new Date(year + 1, 1, 14); // 14 février (année suivante)
    peakStartDate = new Date(year + 1, 1, 1); // 1er février (année suivante)
    peakEndDate = new Date(year + 1, 1, 14); // 14 février (année suivante)
  }

  return {
    quarter,
    endDate: formatDate(endDate),
    deadlineDate: formatDate(deadlineDate),
    peakStartDate: formatDate(peakStartDate),
    peakEndDate: formatDate(peakEndDate),
    year,
  };
}

/**
 * Vérifie si on est dans une période de pic
 */
export function isPeakPeriod(date?: Date): boolean {
  const checkDate = date || new Date();
  const quarter = getCurrentQuarter();

  const peakStart = new Date(quarter.peakStartDate);
  const peakEnd = new Date(quarter.peakEndDate);

  return checkDate >= peakStart && checkDate <= peakEnd;
}

/**
 * Calcule la fréquence de polling recommandée
 * - Pendant les périodes de pic : toutes les minutes
 * - En dehors : toutes les 5 minutes (comme actuellement)
 */
export function getRecommendedPollingInterval(): number {
  if (isPeakPeriod()) {
    return 1; // 1 minute pendant les périodes de pic
  }
  return 5; // 5 minutes en dehors
}

/**
 * Calcule les jours restants avant la deadline
 */
export function getDaysUntilDeadline(): number {
  const quarter = getCurrentQuarter();
  const deadline = new Date(quarter.deadlineDate);
  const now = new Date();
  
  const diffTime = deadline.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.max(0, diffDays);
}

/**
 * Formate une date en YYYY-MM-DD
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Obtient toutes les informations du calendrier pour l'année
 */
export function getYearCalendar(year: number): QuarterInfo[] {
  return [
    {
      quarter: 'Q1',
      endDate: `${year}-03-31`,
      deadlineDate: `${year}-05-15`,
      peakStartDate: `${year}-05-01`,
      peakEndDate: `${year}-05-15`,
      year,
    },
    {
      quarter: 'Q2',
      endDate: `${year}-06-30`,
      deadlineDate: `${year}-08-14`,
      peakStartDate: `${year}-08-01`,
      peakEndDate: `${year}-08-14`,
      year,
    },
    {
      quarter: 'Q3',
      endDate: `${year}-09-30`,
      deadlineDate: `${year}-11-14`,
      peakStartDate: `${year}-11-01`,
      peakEndDate: `${year}-11-14`,
      year,
    },
    {
      quarter: 'Q4',
      endDate: `${year}-12-31`,
      deadlineDate: `${year + 1}-02-14`,
      peakStartDate: `${year + 1}-02-01`,
      peakEndDate: `${year + 1}-02-14`,
      year,
    },
  ];
}
