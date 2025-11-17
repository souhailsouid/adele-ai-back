/**
 * Lambda pour enrichir les signaux avec GPT
 * Déclenché par EventBridge quand un nouveau signal est créé
 */

import { EventBridgeEvent } from "aws-lambda";
import { supabase } from "./supabase";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

export const handler = async (event: EventBridgeEvent<"New Signal", any>) => {
  console.log("Processor IA triggered:", JSON.stringify(event));

  if (!OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY not configured");
    return { statusCode: 500, body: JSON.stringify({ error: "OpenAI API key not configured" }) };
  }

  try {
    const detail = typeof event.detail === 'string' ? JSON.parse(event.detail) : event.detail;
    const signalId = detail.signal_id;

    // 1. Récupérer le signal
    const { data: signal, error: fetchError } = await supabase
      .from("signals")
      .select("*")
      .eq("id", signalId)
      .single();

    if (fetchError) throw fetchError;
    if (!signal) {
      throw new Error(`Signal not found: ${signalId}`);
    }

    // 2. Mettre à jour le statut
    await supabase
      .from("signals")
      .update({ processing_status: "processing" })
      .eq("id", signalId);

    // 3. Appeler GPT pour enrichir
    const enrichment = await enrichWithGPT(signal);

    // 4. Mettre à jour le signal avec les résultats
    const { error: updateError } = await supabase
      .from("signals")
      .update({
        summary: enrichment.summary,
        importance_score: enrichment.importance_score,
        tags: enrichment.tags,
        impact: enrichment.impact,
        priority: enrichment.priority,
        processed_at: new Date().toISOString(),
        processing_status: "completed",
      })
      .eq("id", signalId);

    if (updateError) throw updateError;

    console.log(`Signal ${signalId} enriched successfully`);
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (error: any) {
    console.error("Processor IA error:", error);
    
    // Marquer comme failed
    try {
      await supabase
        .from("signals")
        .update({ processing_status: "failed" })
        .eq("id", event.detail.signal_id);
    } catch (e) {
      console.error("Error updating status:", e);
    }

    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};

async function enrichWithGPT(signal: any) {
  // Construire le prompt selon le type de signal
  const rawData = signal.raw_data || {};
  let prompt = "";

  if (signal.source === "rss") {
    prompt = `Analyze this news article and provide:
- A one-sentence summary
- Importance score (1-10)
- Tags (array: e.g., ["macro", "crypto", "corporate"])
- Expected market impact (brief description)
- Priority level (low/medium/high/critical)

Article: ${rawData.title || ""}
${rawData.description || ""}`;
  } else if (signal.source === "coinglass") {
    prompt = `Analyze this crypto derivatives signal and provide:
- A one-sentence summary
- Importance score (1-10)
- Tags (array)
- Expected market impact
- Priority level

Type: ${signal.type}
Data: ${JSON.stringify(rawData)}`;
  } else if (signal.source === "scrapecreators") {
    prompt = `Analyze this social media post and provide:
- A one-sentence summary
- Importance score (1-10)
- Tags (array)
- Expected market impact
- Priority level

Post: ${rawData.text || ""}`;
  } else {
    prompt = `Analyze this signal and provide:
- A one-sentence summary
- Importance score (1-10)
- Tags (array)
- Expected market impact
- Priority level

Source: ${signal.source}
Type: ${signal.type}
Data: ${JSON.stringify(rawData)}`;
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a financial market analyst. Analyze signals and provide structured JSON responses.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }

  const result = await response.json();
  const content = JSON.parse(result.choices[0]?.message?.content || "{}");

  return {
    summary: content.summary || "",
    importance_score: parseInt(content.importance_score || "5"),
    tags: content.tags || [],
    impact: content.impact || "",
    priority: content.priority || "medium",
  };
}

