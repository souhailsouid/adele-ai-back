/**
 * Routes pour le service Insiders (Read API)
 */

import type { APIGatewayProxyEventV2 } from "aws-lambda";
import type { Route } from "./types";
import { InsidersService } from "../services/insiders.service";
import { InsiderAnalyticsService } from "../services/insider-analytics.service";
import { InsiderAlertsService } from "../services/insider-alerts.service";

const insidersService = new InsidersService();
const analyticsService = new InsiderAnalyticsService();
const alertsService = new InsiderAlertsService();

// Helper functions
function getPathParam(event: APIGatewayProxyEventV2, key: string): string | undefined {
  return event.pathParameters?.[key];
}

function getQueryParam(event: APIGatewayProxyEventV2, key: string): string | undefined {
  return event.queryStringParameters?.[key];
}

export const insidersRoutes: Route[] = [
  /**
   * GET /insiders/trending
   * Top entreprises avec le plus d'achats d'insiders (pondéré par volume financier)
   * 
   * Filtre: Uniquement les transactions "P" (Purchase - Achat sur marché ouvert)
   * Exclut: "G" (Gifts/Cadeaux) et "A" (Attribution gratuite d'options)
   * 
   * Query params:
   * - days: nombre de jours (défaut: 7, accepte n'importe quel nombre positif)
   * - limit: nombre de résultats (défaut: 20)
   */
  {
    method: "GET",
    path: "/insiders/trending",
    handler: async (event) => {
      const daysParam = getQueryParam(event, "days");
      let days = 7; // Défaut
      
      if (daysParam) {
        const parsedDays = parseInt(daysParam, 10);
        // Valider que c'est un nombre positif et raisonnable (max 365 jours)
        if (!isNaN(parsedDays) && parsedDays > 0 && parsedDays <= 365) {
          days = parsedDays;
        }
      }
      
      const limit = getQueryParam(event, "limit") 
        ? parseInt(getQueryParam(event, "limit")!, 10) 
        : 20;

      return await insidersService.getTrendingInsiders(days, limit);
    },
  },

  /**
   * GET /insiders/company/{ticker}
   * Liste toutes les transactions pour une entreprise
   * 
   * Query params:
   * - limit: nombre de résultats (défaut: 100)
   * - offset: offset pour pagination (défaut: 0)
   */
  {
    method: "GET",
    path: "/insiders/company/{ticker}",
    handler: async (event) => {
      const ticker = getPathParam(event, "ticker");
      if (!ticker) throw new Error("Missing ticker parameter");

      const limit = getQueryParam(event, "limit") 
        ? parseInt(getQueryParam(event, "limit")!, 10) 
        : 100;
      const offset = getQueryParam(event, "offset") 
        ? parseInt(getQueryParam(event, "offset")!, 10) 
        : 0;

      return await insidersService.getCompanyInsiderTransactions(ticker, limit, offset);
    },
  },

  /**
   * GET /insiders/person/{cik}
   * Track record d'un dirigeant (cross-company)
   */
  {
    method: "GET",
    path: "/insiders/person/{cik}",
    handler: async (event) => {
      const cik = getPathParam(event, "cik");
      if (!cik) throw new Error("Missing cik parameter");

      const record = await insidersService.getInsiderPersonRecord(cik);
      
      if (!record) {
        return {
          error: "Insider not found",
          cik: cik,
        };
      }

      return record;
    },
  },

  /**
   * GET /insiders/analytics/roi/{cik}
   * Calculer le ROI moyen d'un insider
   * 
   * Query params:
   * - days: période d'analyse en jours (défaut: 365)
   */
  {
    method: "GET",
    path: "/insiders/analytics/roi/{cik}",
    handler: async (event) => {
      const cik = getPathParam(event, "cik");
      if (!cik) throw new Error("Missing cik parameter");

      const days = getQueryParam(event, "days") 
        ? parseInt(getQueryParam(event, "days")!, 10) 
        : 365;

      const roi = await analyticsService.calculateInsiderROI(cik, days);
      
      if (!roi) {
        return {
          error: "Insufficient data to calculate ROI",
          cik: cik,
        };
      }

      return roi;
    },
  },

  /**
   * GET /insiders/analytics/company/{ticker}
   * Calculer le ROI moyen pour une entreprise (tous les insiders)
   */
  {
    method: "GET",
    path: "/insiders/analytics/company/{ticker}",
    handler: async (event) => {
      const ticker = getPathParam(event, "ticker");
      if (!ticker) throw new Error("Missing ticker parameter");

      const days = getQueryParam(event, "days") 
        ? parseInt(getQueryParam(event, "days")!, 10) 
        : 365;

      const roi = await analyticsService.calculateCompanyInsiderROI(ticker, days);
      
      if (!roi) {
        return {
          error: "Insufficient data to calculate ROI",
          ticker: ticker,
        };
      }

      return roi;
    },
  },

  /**
   * GET /insiders/analytics/top
   * Top insiders par ROI
   * 
   * Query params:
   * - limit: nombre de résultats (défaut: 20)
   * - min_transactions: nombre minimum de transactions (défaut: 5)
   */
  {
    method: "GET",
    path: "/insiders/analytics/top",
    handler: async (event) => {
      const limit = getQueryParam(event, "limit") 
        ? parseInt(getQueryParam(event, "limit")!, 10) 
        : 20;
      const minTransactions = getQueryParam(event, "min_transactions") 
        ? parseInt(getQueryParam(event, "min_transactions")!, 10) 
        : 5;

      return await analyticsService.getTopInsidersByROI(limit, minTransactions);
    },
  },

  /**
   * POST /insiders/alerts/scan
   * Scanner les nouvelles transactions et générer des alertes
   * 
   * Body (optionnel):
   * - since_date: date ISO (défaut: 24h)
   * - min_buy_value: seuil minimum pour alerter (défaut: 100000)
   * - min_sell_value: seuil minimum pour alerter (défaut: 500000)
   * - alert_channels: array de 'telegram' | 'discord' | 'email'
   */
  {
    method: "POST",
    path: "/insiders/alerts/scan",
    handler: async (event) => {
      const body = event.body ? JSON.parse(event.body) : {};
      
      const alerts = await alertsService.scanAndAlertNewTransactions(
        body.since_date,
        {
          minBuyValue: body.min_buy_value || 100000,
          minSellValue: body.min_sell_value || 500000,
          alertChannels: body.alert_channels || [],
          telegramBotToken: body.telegram_bot_token || process.env.TELEGRAM_BOT_TOKEN,
          telegramChatId: body.telegram_chat_id || process.env.TELEGRAM_CHAT_ID,
          discordWebhookUrl: body.discord_webhook_url || process.env.DISCORD_WEBHOOK_URL,
          emailRecipients: body.email_recipients || [],
        }
      );

      return {
        alerts_generated: alerts.length,
        alerts: alerts,
      };
    },
  },

  /**
   * GET /insiders/alerts/daily-summary
   * Générer un résumé quotidien des Top 5 Insider Buys
   */
  {
    method: "GET",
    path: "/insiders/alerts/daily-summary",
    handler: async (event) => {
      const summary = await alertsService.generateDailySummary();
      
      return {
        summary: summary,
        generated_at: new Date().toISOString(),
      };
    },
  },

  /**
   * GET /insiders/signals/hot
   * Récupère les 10 derniers "Top Signals" (achats volontaires significatifs)
   * 
   * Query params:
   * - limit: nombre de résultats (défaut: 10, max: 50)
   * - min_score: score minimum (défaut: 5)
   */
  {
    method: "GET",
    path: "/insiders/signals/hot",
    handler: async (event) => {
      const limit = getQueryParam(event, "limit") 
        ? Math.min(parseInt(getQueryParam(event, "limit")!, 10), 50)
        : 10;
      const minScore = getQueryParam(event, "min_score")
        ? parseInt(getQueryParam(event, "min_score")!, 10)
        : 5;

      return await insidersService.getHotSignals(limit, minScore);
    },
  },

  /**
   * GET /insiders/filings
   * Liste des Form 4 filings avec pagination
   * 
   * Query params:
   * - limit: nombre de résultats (défaut: 50)
   * - offset: offset pour pagination (défaut: 0)
   * - days: filtrer par nombre de jours (optionnel)
   */
  {
    method: "GET",
    path: "/insiders/filings",
    handler: async (event) => {
      const limit = getQueryParam(event, "limit") 
        ? parseInt(getQueryParam(event, "limit")!, 10) 
        : 50;
      const offset = getQueryParam(event, "offset") 
        ? parseInt(getQueryParam(event, "offset")!, 10) 
        : 0;
      const days = getQueryParam(event, "days")
        ? parseInt(getQueryParam(event, "days")!, 10)
        : undefined;
      const hasTransactions = getQueryParam(event, "has_transactions") !== 'false'; // Défaut: true

      return await insidersService.getForm4Filings(limit, offset, days, hasTransactions);
    },
  },

  /**
   * GET /insiders/filings/{filingId}
   * Détails d'un Form 4 filing
   */
  {
    method: "GET",
    path: "/insiders/filings/{filingId}",
    handler: async (event) => {
      const filingId = getPathParam(event, "filingId");
      if (!filingId) throw new Error("Missing filingId parameter");

      const filing = await insidersService.getForm4Filing(parseInt(filingId, 10));
      
      if (!filing) {
        return {
          error: "Filing not found",
          filingId: filingId,
        };
      }

      return filing;
    },
  },

  /**
   * GET /insiders/company/{ticker}/filings
   * Form 4 filings pour une entreprise
   * 
   * Query params:
   * - limit: nombre de résultats (défaut: 50)
   * - offset: offset pour pagination (défaut: 0)
   */
  {
    method: "GET",
    path: "/insiders/company/{ticker}/filings",
    handler: async (event) => {
      const ticker = getPathParam(event, "ticker");
      if (!ticker) throw new Error("Missing ticker parameter");

      const limit = getQueryParam(event, "limit") 
        ? parseInt(getQueryParam(event, "limit")!, 10) 
        : 50;
      const offset = getQueryParam(event, "offset") 
        ? parseInt(getQueryParam(event, "offset")!, 10) 
        : 0;
      const hasTransactions = getQueryParam(event, "has_transactions") !== 'false'; // Défaut: true

      return await insidersService.getCompanyForm4Filings(ticker, limit, offset, hasTransactions);
    },
  },

  /**
   * GET /insiders/person/{cik}/filings
   * Form 4 filings pour un insider
   * 
   * Query params:
   * - limit: nombre de résultats (défaut: 50)
   * - offset: offset pour pagination (défaut: 0)
   */
  {
    method: "GET",
    path: "/insiders/person/{cik}/filings",
    handler: async (event) => {
      const cik = getPathParam(event, "cik");
      if (!cik) throw new Error("Missing cik parameter");

      const limit = getQueryParam(event, "limit") 
        ? parseInt(getQueryParam(event, "limit")!, 10) 
        : 50;
      const offset = getQueryParam(event, "offset") 
        ? parseInt(getQueryParam(event, "offset")!, 10) 
        : 0;
      const hasTransactions = getQueryParam(event, "has_transactions") !== 'false'; // Défaut: true

      return await insidersService.getInsiderForm4Filings(cik, limit, offset, hasTransactions);
    },
  },

  /**
   * GET /insiders/filings/{filingId}/transactions
   * Transactions d'un Form 4 filing
   * 
   * Query params:
   * - limit: nombre de résultats (défaut: 100)
   */
  {
    method: "GET",
    path: "/insiders/filings/{filingId}/transactions",
    handler: async (event) => {
      const filingId = getPathParam(event, "filingId");
      if (!filingId) throw new Error("Missing filingId parameter");

      const limit = getQueryParam(event, "limit") 
        ? parseInt(getQueryParam(event, "limit")!, 10) 
        : 100;

      return await insidersService.getForm4FilingTransactions(parseInt(filingId, 10), limit);
    },
  },
];
