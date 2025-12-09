/**
 * Interface publique pour le service de calendrier économique combiné
 */

import { EconomicCalendarService } from './services/economic-calendar.service';

const economicCalendarService = new EconomicCalendarService();

export async function getCombinedEconomicCalendar(params: {
  from?: string;
  to?: string;
}) {
  return await economicCalendarService.getCombinedEconomicCalendar(params);
}








