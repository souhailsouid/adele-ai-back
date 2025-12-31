import { supabase } from '../supabase';
import { logger } from '../utils/logger';
import type {
  OptionsFiveFactors,
  OptionsFiveFactorsMaxPain,
  OptionsFiveFactorsOIChange,
  OptionsFiveFactorsOIPerStrike,
  OptionsFiveFactorsRecentFlows,
} from '../types/ai-analyst';

function isCallFlow(row: any): boolean {
  const t = (row.option_type || row.type || row.call_put || '').toLowerCase();
  return t === 'call' || t === 'c';
}

function isPutFlow(row: any): boolean {
  const t = (row.option_type || row.type || row.call_put || '').toLowerCase();
  return t === 'put' || t === 'p';
}

function isCallSymbol(symbol: string | null | undefined): boolean {
  if (!symbol) return false;
  const s = symbol.toUpperCase();
  return s.includes('C');
}

function isPutSymbol(symbol: string | null | undefined): boolean {
  if (!symbol) return false;
  const s = symbol.toUpperCase();
  return s.includes('P');
}

export class OptionsAnalyticsService {
  /**
   * Construit la structure OptionsFiveFactors à partir des tables d'ingestion
   * (options_flow, oi_change, oi_per_strike, iv_rank, max_pain, ticker_quotes).
   *
   * L'objectif est de fournir à l'IA des données DÉJÀ AGRÉGÉES et propres,
   * sans qu'elle ait à parcourir des milliers de lignes brutes.
   */
  async buildFiveFactors(ticker: string): Promise<OptionsFiveFactors | null> {
    const upper = ticker.toUpperCase();
    const nowIso = new Date().toISOString();
    const log = logger.child({ operation: 'buildFiveFactors', ticker: upper });

    // 1) Recent Flows (options_flow)
    const { data: flowRows, error: flowError } = await supabase
      .from('options_flow')
      .select('*')
      .eq('ticker', upper)
      .gt('expires_at', nowIso)
      .order('date', { ascending: false })
      .order('cached_at', { ascending: false })
      .limit(200);

    if (flowError) {
      log.error('Error loading options_flow', { error: flowError });
    }

    const validFlows = (flowRows || []).filter((f: any) => !f.is_empty_marker);
    const hasAnyFlowRows = Array.isArray(flowRows) && flowRows.length > 0;
    const flowsAvailable = validFlows.length > 0;
    if (!flowsAvailable) {
      log.warn('No recent options flow data for five factors analysis', {
        hasAnyFlowRows,
        rowsCount: (flowRows || []).length,
      });
    }

    const callVolume = flowsAvailable
      ? validFlows.reduce((sum: number, f: any) => {
          if (f.call_volume != null) return sum + (f.call_volume || 0);
          return sum + (isCallFlow(f) ? (f.volume || 0) : 0);
        }, 0)
      : 0;

    const putVolume = flowsAvailable
      ? validFlows.reduce((sum: number, f: any) => {
          if (f.put_volume != null) return sum + (f.put_volume || 0);
          return sum + (isPutFlow(f) ? (f.volume || 0) : 0);
        }, 0)
      : 0;

    const totalVolume = callVolume + putVolume;
    const totalPremium = flowsAvailable
      ? validFlows.reduce(
          (sum: number, f: any) =>
            sum +
            (f.total_premium != null
              ? f.total_premium
              : typeof f.premium === 'string'
              ? parseFloat(f.premium)
              : f.premium || 0),
          0
        )
      : 0;
    const callPutRatio = putVolume > 0 ? callVolume / putVolume : callVolume > 0 ? 999 : 0;
    const direction: OptionsFiveFactorsRecentFlows['direction'] =
      callPutRatio > 1.3 ? 'bullish' : callPutRatio < 0.7 ? 'bearish' : 'neutral';

    const topTrades = flowsAvailable
      ? [...validFlows]
          .sort(
            (a: any, b: any) =>
              (b.total_premium || b.premium || 0) - (a.total_premium || a.premium || 0)
          )
          .slice(0, 20)
          .map((f: any) => ({
            option_symbol: f.option_symbol || f.symbol || f.ticker,
            strike: f.strike != null ? Number(f.strike) : null,
            expiry: f.expiry || f.expiration_date || null,
            type: (f.option_type || f.type || f.call_put || 'unknown').toLowerCase() as
              | 'call'
              | 'put'
              | 'unknown',
            volume: f.volume || 0,
            premium:
              f.total_premium != null
                ? f.total_premium
                : typeof f.premium === 'string'
                ? parseFloat(f.premium)
                : f.premium || null,
            executed_at: f.executed_at || f.date || null,
          }))
      : [];

    const recentFlows: OptionsFiveFactorsRecentFlows = {
      available: flowsAvailable,
      direction,
      call_volume: callVolume,
      put_volume: putVolume,
      call_put_ratio: callPutRatio,
      total_premium: totalPremium,
      top_trades: topTrades,
    };

    // 1b) Flow repetition (intraday vs multi-day persistence)
    // We only use the already ingested flows; no live calls.
    const byDay = new Map<string, { trades: number; premium: number; callVol: number; putVol: number }>();
    validFlows.forEach((f: any) => {
      const day = f.data_date || f.date || null;
      if (!day) return;
      const premiumVal =
        f.total_premium != null
          ? Number(f.total_premium)
          : typeof f.premium === 'string'
          ? parseFloat(f.premium)
          : Number(f.premium || 0);
      const volVal = Number(f.volume || 0);
      const row = byDay.get(day) || { trades: 0, premium: 0, callVol: 0, putVol: 0 };
      row.trades += 1;
      row.premium += Number.isFinite(premiumVal) ? premiumVal : 0;
      row.callVol += isCallFlow(f) ? volVal : 0;
      row.putVol += isPutFlow(f) ? volVal : 0;
      byDay.set(day, row);
    });
    const flowDays = Array.from(byDay.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .slice(0, 3)
      .map(([date, v]) => ({
        date,
        trades_count: v.trades,
        premium_sum: v.premium,
        call_volume: v.callVol,
        put_volume: v.putVol,
      }));
    const flowRepetition = {
      unique_days: Array.from(byDay.keys()).length,
      days: flowDays,
    };

    // 2) OI Change (oi_change)
    const { data: oiRows, error: oiError } = await supabase
      .from('oi_change')
      .select('*')
      .eq('ticker', upper)
      .order('data_date', { ascending: false })
      .limit(500);

    if (oiError) {
      log.error('Error loading oi_change', { error: oiError });
    }

    let oiChangeBlock: OptionsFiveFactorsOIChange | null = null;
    if (oiRows && oiRows.length) {
      const latestDate = oiRows[0].data_date;
      const latest = oiRows.filter((r: any) => r.data_date === latestDate);
      const totalChange = latest.reduce(
        (sum: number, r: any) => sum + (r.oi_diff_plain || 0),
        0
      );
      const callChange = latest
        .filter((r: any) => isCallSymbol(r.option_symbol))
        .reduce((sum: number, r: any) => sum + (r.oi_diff_plain || 0), 0);
      const putChange = latest
        .filter((r: any) => isPutSymbol(r.option_symbol))
        .reduce((sum: number, r: any) => sum + (r.oi_diff_plain || 0), 0);

      const sorted = [...latest].sort(
        (a: any, b: any) => (b.oi_diff_plain || 0) - (a.oi_diff_plain || 0)
      );

      oiChangeBlock = {
        total_change: totalChange,
        call_oi_change: callChange,
        put_oi_change: putChange,
        top_increases: sorted.slice(0, 10).map((r: any) => ({
          option_symbol: r.option_symbol,
          strike: null,
          expiry: r.curr_date || r.last_date || latestDate,
          oi_diff_plain: r.oi_diff_plain || 0,
          oi_change: r.oi_change != null ? Number(r.oi_change) : null,
        })),
        top_decreases: [...sorted]
          .reverse()
          .slice(0, 10)
          .map((r: any) => ({
            option_symbol: r.option_symbol,
            strike: null,
            expiry: r.curr_date || r.last_date || latestDate,
            oi_diff_plain: r.oi_diff_plain || 0,
            oi_change: r.oi_change != null ? Number(r.oi_change) : null,
          })),
      };
    }

    // 3) OI per strike (oi_per_strike)
    const { data: strikeRows, error: strikeError } = await supabase
      .from('oi_per_strike')
      .select('*')
      .eq('ticker', upper)
      .order('data_date', { ascending: false })
      .limit(500);

    if (strikeError) {
      log.error('Error loading oi_per_strike', { error: strikeError });
    }

    let oiPerStrikeBlock: OptionsFiveFactorsOIPerStrike | null = null;
    if (strikeRows && strikeRows.length) {
      const latestDate = (strikeRows as any[])[0].data_date;
      const latest = (strikeRows as any[]).filter((r) => r.data_date === latestDate);
      const topStrikes = latest
        .map((r: any) => ({
          strike: r.strike != null ? Number(r.strike) : 0,
          call_oi: r.call_oi || 0,
          put_oi: r.put_oi || 0,
          total_oi: (r.call_oi || 0) + (r.put_oi || 0),
        }))
        .sort((a, b) => b.total_oi - a.total_oi)
        .slice(0, 15);

      oiPerStrikeBlock = {
        top_strikes: topStrikes,
      };
    }

    // Deterministic OI concentration metric (top1 / sum top10)
    const top10 = oiPerStrikeBlock?.top_strikes?.slice(0, 10) || [];
    const top1Total = top10.length ? (top10[0].total_oi || 0) : null;
    const top10Sum = top10.length ? top10.reduce((s: number, r: any) => s + (r.total_oi || 0), 0) : null;
    const oi_concentration_ratio =
      top1Total != null && top10Sum != null && top10Sum > 0 ? top1Total / top10Sum : null;

    // 4) IV Rank (iv_rank)
    const { data: ivRows, error: ivError } = await supabase
      .from('iv_rank')
      .select('*')
      .eq('ticker', upper)
      .order('data_date', { ascending: false })
      .limit(1);

    if (ivError) {
      log.error('Error loading iv_rank', { error: ivError });
    }

    const ivBlock =
      ivRows && ivRows.length
        ? {
            latest_date: (ivRows as any[])[0].data_date,
            iv_rank_1y:
              (ivRows as any[])[0].iv_rank_1y != null
                ? Number((ivRows as any[])[0].iv_rank_1y)
                : null,
            volatility:
              (ivRows as any[])[0].volatility != null
                ? Number((ivRows as any[])[0].volatility)
                : null,
            close:
              (ivRows as any[])[0].close != null
                ? Number((ivRows as any[])[0].close)
                : null,
          }
        : null;

    // 5) Max Pain (max_pain + ticker_quotes pour le spot)
    const { data: mpRows, error: mpError } = await supabase
      .from('max_pain')
      .select('*')
      .eq('ticker', upper)
      .order('data_date', { ascending: true })
      .order('expiry', { ascending: true });

    if (mpError) {
      log.error('Error loading max_pain', { error: mpError });
    }

    const { data: quoteRows, error: quoteError } = await supabase
      .from('ticker_quotes')
      .select('*')
      .eq('ticker', upper)
      .order('cached_at', { ascending: false })
      .limit(1);

    if (quoteError) {
      log.error('Error loading ticker_quotes', { error: quoteError });
    }

    let maxPainBlock: OptionsFiveFactorsMaxPain | null = null;
    if (mpRows && mpRows.length) {
      const currentPrice =
        quoteRows && quoteRows.length
          ? (quoteRows as any[])[0].price || (quoteRows as any[])[0].last || null
          : null;

      const lastRow = (mpRows as any[])[(mpRows as any[]).length - 1];
      const latestDate = lastRow.data_date;
      const latest = (mpRows as any[]).filter((r) => r.data_date === latestDate);

      // Filter out already-expired expiries when choosing "nearest" (prevents misleading pin-risk from past expirations)
      const todayIso = new Date().toISOString().split('T')[0];
      const latestFuture = latest.filter((r: any) => !r.expiry || String(r.expiry) >= todayIso);

      const rows = latest.map((r: any) => {
        const mp = r.max_pain != null ? Number(r.max_pain) : null;
        const distance =
          currentPrice != null && mp != null
            ? Math.abs((currentPrice - mp) / currentPrice)
            : null;
        return {
          expiry: r.expiry,
          max_pain: mp || 0,
          distance_from_spot: distance,
        };
      });

      const rowsFuture = latestFuture.map((r: any) => {
        const mp = r.max_pain != null ? Number(r.max_pain) : null;
        const distance =
          currentPrice != null && mp != null
            ? Math.abs((currentPrice - mp) / currentPrice)
            : null;
        return {
          expiry: r.expiry,
          max_pain: mp || 0,
          distance_from_spot: distance,
        };
      });

      const nearestSource = rowsFuture.length ? rowsFuture : rows;
      const nearest =
        nearestSource
          .filter((r) => r.distance_from_spot != null)
          .sort(
            (a, b) =>
              (a.distance_from_spot as number) - (b.distance_from_spot as number)
          )[0] || null;

      maxPainBlock = {
        current_spot: currentPrice || null,
        rows,
        nearest_expiry: nearest,
      };
    }

    const asOf =
      ivBlock?.latest_date ||
      (oiRows && oiRows[0]?.data_date) ||
      (strikeRows && (strikeRows as any[])[0]?.data_date) ||
      new Date().toISOString().split('T')[0];

    // 5b) Greeks aggregated (gamma map): greeks table (ingested from UW greek-exposure/strike)
    const { data: greeksRows } = await supabase
      .from('greeks')
      .select('*')
      .eq('ticker', upper)
      .gt('expires_at', nowIso)
      .order('data_date', { ascending: false })
      .order('cached_at', { ascending: false })
      .limit(1);
    const g = greeksRows && greeksRows.length ? (greeksRows as any[])[0] : null;
    const greeksAggregated = g
      ? {
          as_of: g.data_date || asOf,
          net_gamma_exposure: g.net_gamma_exposure != null ? Number(g.net_gamma_exposure) : null,
          net_delta_exposure: g.net_delta_exposure != null ? Number(g.net_delta_exposure) : null,
          top_gamma_strikes: Array.isArray(g.data?.top_gamma_strikes)
            ? g.data.top_gamma_strikes.map((r: any) => ({
                strike: r.strike != null ? Number(r.strike) : 0,
                net_gamma_exposure: r.net_gamma_exposure != null ? Number(r.net_gamma_exposure) : 0,
                call_gamma_exposure: r.call_gamma_exposure != null ? Number(r.call_gamma_exposure) : 0,
                put_gamma_exposure: r.put_gamma_exposure != null ? Number(r.put_gamma_exposure) : 0,
                net_delta_exposure: r.net_delta_exposure != null ? Number(r.net_delta_exposure) : 0,
                call_delta_exposure: r.call_delta_exposure != null ? Number(r.call_delta_exposure) : 0,
                put_delta_exposure: r.put_delta_exposure != null ? Number(r.put_delta_exposure) : 0,
              }))
            : [],
        }
      : null;

    // 6) Price context (ticker_price_context + ticker_quotes)
    const { data: pcRows } = await supabase
      .from('ticker_price_context')
      .select('*')
      .eq('ticker', upper)
      .gt('expires_at', nowIso)
      .order('data_date', { ascending: false })
      .order('cached_at', { ascending: false })
      .limit(1);

    const pc = pcRows && pcRows.length ? (pcRows as any[])[0] : null;
    const spot = pc?.spot ?? maxPainBlock?.current_spot ?? null;
    const sma20 = pc?.sma_20 != null ? Number(pc.sma_20) : null;
    const sma50 = pc?.sma_50 != null ? Number(pc.sma_50) : null;
    const dist20 = spot && sma20 ? (Number(spot) - sma20) / sma20 : null;
    const dist50 = spot && sma50 ? (Number(spot) - sma50) / sma50 : null;
    const priceVsSma20Pct = dist20 != null ? dist20 * 100 : null;
    const priceVsSma50Pct = dist50 != null ? dist50 * 100 : null;

    const trend2050: "up" | "down" | "flat" | "unknown" =
      sma20 != null && sma50 != null
        ? sma20 > sma50 * 1.002
          ? "up"
          : sma20 < sma50 * 0.998
          ? "down"
          : "flat"
        : "unknown";

    const regimeTrend: "up" | "down" | "range" | "unknown" =
      trend2050 === "unknown" || spot == null || sma20 == null || sma50 == null
        ? "unknown"
        : trend2050 === "up" && Number(spot) >= sma20 && Number(spot) >= sma50
        ? "up"
        : trend2050 === "down" && Number(spot) <= sma20 && Number(spot) <= sma50
        ? "down"
        : "range";

    const adx14 =
      pc?.data?.adx14?.adx != null
        ? Number(pc.data.adx14.adx)
        : pc?.data?.adx_14 != null
        ? Number(pc.data.adx_14)
        : pc?.data?.adx14 != null && typeof pc.data.adx14 === "number"
        ? Number(pc.data.adx14)
        : null;
    const marketState: "trending" | "choppy" | "unknown" =
      adx14 == null ? "unknown" : adx14 >= 25 ? "trending" : "choppy";

    const realizedVol20d =
      pc?.data?.realized_vol_20d != null ? Number(pc.data.realized_vol_20d) : null;

    const priceContext = pc
      ? {
          spot: spot != null ? Number(spot) : null,
          change_percent: pc.change_percent != null ? Number(pc.change_percent) : null,
          volume: pc.volume != null ? Number(pc.volume) : null,
          sma_20: sma20,
          sma_50: sma50,
          stddev_20: pc.stddev_20 != null ? Number(pc.stddev_20) : null,
          range_5d_pct: pc.range_5d_pct != null ? Number(pc.range_5d_pct) : null,
          distance_to_sma_20: dist20,
          distance_to_sma_50: dist50,
          trend_20_50: trend2050,
          trend: regimeTrend,
          price_vs_sma20_pct: priceVsSma20Pct,
          price_vs_sma50_pct: priceVsSma50Pct,
          adx_14: adx14,
          market_state: marketState,
          realized_vol_20d: realizedVol20d,
        }
      : null;

    // Flow vs OI ratios (context, not a signal)
    const oiChangeTotal = oiChangeBlock?.total_change != null ? Number(oiChangeBlock.total_change) : null;
    const flowToOiChangeRatio =
      oiChangeTotal != null && oiChangeTotal !== 0 ? totalVolume / Math.abs(oiChangeTotal) : null;
    const topStrikesTotalOi =
      oiPerStrikeBlock?.top_strikes?.length
        ? oiPerStrikeBlock.top_strikes.reduce((s: number, r: any) => s + (r.total_oi || 0), 0)
        : null;
    const flowContext = {
      total_flow_volume: totalVolume,
      total_flow_premium: totalPremium,
      oi_change_total: oiChangeTotal,
      flow_to_oi_change_ratio: flowToOiChangeRatio,
      top_strikes_total_oi: topStrikesTotalOi,
      // extra deterministic metric for AI quality control
      oi_concentration_ratio: oi_concentration_ratio,
    };

    // 7) Catalysts (earnings timing from ticker_earnings)
    const todayDate = new Date().toISOString().split('T')[0];
    const { data: earningsRows } = await supabase
      .from('ticker_earnings')
      .select('*')
      .eq('ticker', upper)
      .gte('report_date', todayDate)
      .order('report_date', { ascending: true })
      .limit(1);

    const nextE = earningsRows && earningsRows.length ? (earningsRows as any[])[0] : null;
    let daysToEarnings: number | null = null;
    if (nextE?.report_date) {
      const d0 = new Date(todayDate);
      const d1 = new Date(nextE.report_date);
      daysToEarnings = Math.round((d1.getTime() - d0.getTime()) / (1000 * 60 * 60 * 24));
    }
    const catalysts = nextE
      ? {
          next_earnings_date: nextE.report_date || null,
          report_time: nextE.report_time || null,
          days_to_earnings: daysToEarnings,
          is_earnings_week: daysToEarnings != null ? daysToEarnings >= 0 && daysToEarnings <= 7 : false,
          expected_move_perc: nextE.expected_move_perc != null ? Number(nextE.expected_move_perc) : null,
        }
      : null;

    // 8) Dark pool context (from dark_pool_trades)
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const { data: dpRows } = await supabase
      .from('dark_pool_trades')
      .select('*')
      .eq('ticker', upper)
      .eq('is_empty_marker', false)
      .gte('data_date', since30)
      .order('executed_at', { ascending: false })
      .limit(500);

    const dp = Array.isArray(dpRows) ? dpRows : [];
    const totalValue = dp.reduce((s: number, r: any) => s + (r.value ? Number(r.value) : 0), 0);
    const totalVol = dp.reduce((s: number, r: any) => s + (r.volume ? Number(r.volume) : (r.size ? Number(r.size) : 0)), 0);
    const avgSize = dp.length > 0 ? totalVol / dp.length : null;

    // Baseline "30d avg" simple: moyenne journalière sur 30 jours (si au moins 10 trades)
    const dpByDay = new Map<string, number>();
    dp.forEach((r: any) => {
      const day = r.data_date || (r.executed_at ? new Date(r.executed_at).toISOString().split('T')[0] : null);
      if (!day) return;
      dpByDay.set(day, (dpByDay.get(day) || 0) + (r.value ? Number(r.value) : 0));
    });
    const dailyVals = Array.from(dpByDay.values());
    const avgDaily30 = dailyVals.length > 0 ? dailyVals.reduce((a, b) => a + b, 0) / dailyVals.length : null;
    const lastDay = dp.length > 0 ? (dp[0].data_date || null) : null;
    const lastDayVal = lastDay ? dpByDay.get(lastDay) || null : null;
    const vsAvg30 = avgDaily30 && lastDayVal != null ? lastDayVal / avgDaily30 : null;

    const darkPoolContext = dp.length
      ? {
          count: dp.length,
          total_value: totalValue || null,
          total_volume: totalVol || null,
          avg_trade_size: avgSize,
          vs_avg_30d_value: vsAvg30,
        }
      : null;

    const result: OptionsFiveFactors = {
      ticker: upper,
      as_of: asOf,
      recent_flows: recentFlows,
      oi_change: oiChangeBlock,
      oi_per_strike: oiPerStrikeBlock,
      iv_rank: ivBlock,
      max_pain: maxPainBlock,
      greeks_aggregated: greeksAggregated,
      flow_context: flowContext,
      flow_repetition: flowRepetition,
      price_context: priceContext,
      catalysts,
      dark_pool: darkPoolContext,
    };

    // If absolutely no options-related blocks exist, return null (keep route behavior)
    const hasAnyOptionsSignals =
      flowsAvailable || !!oiChangeBlock || !!oiPerStrikeBlock || !!ivBlock || !!maxPainBlock;
    if (!hasAnyOptionsSignals) {
      log.warn('No options blocks available (flows/OI/IV/max pain all missing)');
      return null;
    }

    return result;
  }
}


