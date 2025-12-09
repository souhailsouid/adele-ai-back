/**
 * Interface publique pour le service de 13F filings
 */

import { Filing13FService } from './services/13f-filings.service';

const filing13FService = new Filing13FService();

export async function getLatest13FFilings(params: {
  from?: string;
  to?: string;
  limit?: number;
}) {
  return await filing13FService.getLatest13FFilings(params);
}








