/**
 * Helper pour router-funds.ts: Résoudre CIK en ID
 */

import { resolveFundId } from "./funds";

/**
 * Helper pour extraire le fund ID depuis un paramètre CIK ou ID
 */
export async function getFundIdFromPath(event: any, paramName: string = "cik"): Promise<number> {
  const cikOrId = event.pathParameters?.[paramName];
  if (!cikOrId) {
    throw new Error(`Missing ${paramName} parameter`);
  }
  return await resolveFundId(cikOrId);
}
