/**
 * Routes d'ingestion macro (non ticker-specific)
 * Couche A : Collecte rapide, idempotente
 *
 * Objectif: ingérer et mettre en cache le calendrier macro pertinent (US/CN/JP uniquement)
 * pour être consommé par /ai/market-risk-overlay.
 */

import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { aiAnalystService } from '../services/ai-analyst.service';
import { getCombinedEconomicCalendar } from '../economic-calendar';
import { supabase } from '../supabase';

function getBody(event: APIGatewayProxyEventV2): any {
  try {
    return JSON.parse(event.body || '{}');
  } catch {
    return {};
  }
}

function isRelevantMacroRegion(e: any): boolean {
  const country = String(e?.country || '').toLowerCase();
  const currency = String(e?.currency || '').toLowerCase();
  const name = String(e?.event || '').toLowerCase();

  // Prefer explicit country/currency when present (FMP)
  const isUS = country.includes('united states') || country === 'us' || currency === 'usd';
  const isJP = country.includes('japan') || country === 'jp' || currency === 'jpy' || name.includes('boj');
  const isCN = country.includes('china') || country === 'cn' || currency === 'cny' || name.includes('pboc');

  // If no metadata, do a conservative name-based filter
  const nameSignals =
    name.includes('fomc') ||
    name.includes('fed') ||
    name.includes('cpi') ||
    name.includes('nonfarm') ||
    name.includes('payroll') ||
    name.includes('boJ'.toLowerCase()) ||
    name.includes('pbo') ||
    name.includes('china') ||
    name.includes('japan');

  return isUS || isJP || isCN || nameSignals;
}

export const macroIngestionRoutes = [
  /**
   * POST /ingest/macro-calendar
   * Ingest (cache) upcoming macro calendar events (US/CN/JP only).
   *
   * Body:
   * { "lookahead_days": 7 }
   */
  {
    method: 'POST',
    path: '/ingest/macro-calendar',
    handler: async (event: APIGatewayProxyEventV2) => {
      const body = getBody(event);
      const lookaheadDays = Math.max(1, Math.min(30, Number(body.lookahead_days || 7)));

      const today = new Date();
      const from = today.toISOString().split('T')[0];
      const to = new Date(today.getTime() + lookaheadDays * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

      // DB-first: if we already have fresh events stored, return them.
      const nowIso = new Date().toISOString();
      const { data: existing, error: existingErr } = await supabase
        .from('macro_calendar_events')
        .select('date,event,country,currency,impact,time,source,expires_at')
        .eq('scope', 'US/CN/JP')
        .gte('date', from)
        .lte('date', to)
        .gt('expires_at', nowIso)
        .order('date', { ascending: true })
        .limit(200);

      if (!existingErr && Array.isArray(existing) && existing.length > 0) {
        return {
          success: true,
          scope: 'US/CN/JP',
          from,
          to,
          count: existing.length,
          events: existing.map((e: any) => ({
            date: e.date,
            event: e.event,
            country: e.country ?? null,
            currency: e.currency ?? null,
            impact: e.impact ?? null,
            time: e.time ?? null,
            source: e.source ?? null,
          })),
          cached: true,
          timestamp: new Date().toISOString(),
        };
      }

      const calendar = await getCombinedEconomicCalendar({ from, to });
      const events = (calendar?.success ? calendar.data || [] : [])
        .filter(isRelevantMacroRegion)
        .slice(0, 200)
        .map((e: any) => ({
          date: e.date,
          event: e.event,
          country: e.country ?? null,
          currency: e.currency ?? null,
          impact: e.impact ?? null,
          time: e.time ?? null,
          source: e.source ?? null,
        }));

      // Upsert into DB (freshness window)
      const expiresAt = new Date(Date.now() + 6 * 3600 * 1000).toISOString();
      if (events.length > 0) {
        const rows = events.map((e: any) => ({
          scope: 'US/CN/JP',
          date: e.date,
          event: e.event,
          country: e.country,
          currency: e.currency,
          impact: e.impact,
          time: e.time,
          source: e.source,
          expires_at: expiresAt,
          cached_at: new Date().toISOString(),
        }));

        const { error: upsertErr } = await supabase
          .from('macro_calendar_events')
          .upsert(rows as any, { onConflict: 'scope,date,event' });
        if (upsertErr) {
          // Non-fatal: still return response payload
          // (DB reliability improves; but API should still respond)
        }
      }

      const response = {
        success: true,
        scope: 'US/CN/JP',
        from,
        to,
        count: events.length,
        events,
        cached: false,
        timestamp: new Date().toISOString(),
      };

      return response;
    },
  },
];


