import { supabase } from "./supabase";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function chatWithData(userQuery: string) {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  // 1. Recherche dans Supabase (recherche textuelle)
  const { data: signals, error: searchError } = await supabase
    .from("signals")
    .select("*")
    .or(`summary.ilike.%${userQuery}%,raw_data.ilike.%${userQuery}%`)
    .order("importance_score", { ascending: false, nullsFirst: false })
    .order("timestamp", { ascending: false })
    .limit(10);

  if (searchError) throw searchError;

  // 2. Construire le contexte pour GPT
  const context = signals
    ?.map((s) => {
      const date = new Date(s.timestamp).toLocaleDateString();
      return `[${date}] ${s.source}/${s.type}: ${s.summary || "No summary"} (Importance: ${s.importance_score || "N/A"})`;
    })
    .join("\n") || "No relevant signals found.";

  // 3. Appeler OpenAI
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
          content: `You are ADEL AI, an intelligent assistant that analyzes trading signals from multiple sources (Trump/social media, crypto derivatives, news, SEC filings).

You have access to the following signals from the database:
${context}

Answer the user's question based ONLY on these signals. If the information is not in the signals, say so.`,
        },
        {
          role: "user",
          content: userQuery,
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }

  const result = await response.json();
  return {
    answer: result.choices[0]?.message?.content || "No response",
    signals_used: signals?.length || 0,
    signals: signals?.slice(0, 5), // Top 5 signals utilisés
  };
}

