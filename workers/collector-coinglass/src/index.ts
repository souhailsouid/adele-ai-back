/**
 * Lambda pour collecter les données CoinGlass (funding, OI, liquidations)
 * Déclenché par EventBridge (cron: toutes les heures)
 */

import { EventBridgeEvent } from "aws-lambda";
import { supabase } from "./supabase";
import { PutEventsCommand, EventBridgeClient } from "@aws-sdk/client-eventbridge";

const eventBridge = new EventBridgeClient({});
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME || "";
const COINGLASS_API_KEY = process.env.COINGLASS_API_KEY || "";

export const handler = async (event: EventBridgeEvent<"Scheduled Event", any>) => {
  console.log("CoinGlass Collector triggered");

  if (!COINGLASS_API_KEY) {
    console.log("CoinGlass API key not configured, skipping");
    return { statusCode: 200, body: JSON.stringify({ message: "API key not configured" }) };
  }

  try {
    // Collecter funding rates
    await collectFundingRates();
    
    // Collecter Open Interest
    await collectOpenInterest();
    
    // Collecter liquidations
    await collectLiquidations();

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (error: any) {
    console.error("CoinGlass Collector error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};

async function collectFundingRates() {
  const response = await fetch("https://fapi.coinglass.com/api/futures/v2/funding-rate", {
    headers: {
      "coinglassSecret": COINGLASS_API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`CoinGlass API error: ${response.status}`);
  }

  const data = await response.json();
  
  // Traiter les données de funding
  if (data.data) {
    for (const item of data.data) {
      const fundingRate = parseFloat(item.fundingRate || 0);
      
      // Détecter les spikes significatifs (> 0.01% ou < -0.01%)
      if (Math.abs(fundingRate) > 0.0001) {
        await createSignal({
          source: "coinglass",
          type: "funding",
          raw_data: {
            symbol: item.symbol,
            fundingRate: fundingRate,
            exchange: item.exchange,
          },
        });
      }
    }
  }
}

async function collectOpenInterest() {
  const response = await fetch("https://fapi.coinglass.com/api/futures/v2/open-interest", {
    headers: {
      "coinglassSecret": COINGLASS_API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`CoinGlass API error: ${response.status}`);
  }

  const data = await response.json();
  
  // Traiter OI changes significatifs
  if (data.data) {
    for (const item of data.data) {
      const oiChange = parseFloat(item.change24h || 0);
      
      // Détecter les changements > 10%
      if (Math.abs(oiChange) > 10) {
        await createSignal({
          source: "coinglass",
          type: "oi",
          raw_data: {
            symbol: item.symbol,
            openInterest: item.openInterest,
            change24h: oiChange,
          },
        });
      }
    }
  }
}

async function collectLiquidations() {
  const response = await fetch("https://fapi.coinglass.com/api/liquidation/v2/liquidation", {
    headers: {
      "coinglassSecret": COINGLASS_API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`CoinGlass API error: ${response.status}`);
  }

  const data = await response.json();
  
  // Traiter les liquidations importantes (> 10M$)
  if (data.data) {
    for (const item of data.data) {
      const liquidationAmount = parseFloat(item.liquidationAmount || 0);
      
      if (liquidationAmount > 10_000_000) {
        await createSignal({
          source: "coinglass",
          type: "liquidation",
          raw_data: {
            symbol: item.symbol,
            liquidationAmount: liquidationAmount,
            side: item.side,
            exchange: item.exchange,
          },
        });
      }
    }
  }
}

async function createSignal(signalData: {
  source: string;
  type: string;
  raw_data: any;
}) {
  const { data: signal, error } = await supabase
    .from("signals")
    .insert({
      source: signalData.source,
      type: signalData.type,
      timestamp: new Date().toISOString(),
      raw_data: signalData.raw_data,
      processing_status: "pending",
    })
    .select()
    .single();

  if (error) throw error;

  // Publier événement pour traitement IA
  await eventBridge.send(new PutEventsCommand({
    Entries: [{
      Source: "adel.signals",
      DetailType: "New Signal",
      Detail: JSON.stringify({
        signal_id: signal.id,
      }),
      EventBusName: EVENT_BUS_NAME,
    }],
  }));

  return signal;
}

