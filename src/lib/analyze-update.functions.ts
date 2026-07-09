import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Analysis = {
  observation: string;
  suggestions: string[];
  problems: string[];
  watch: string[];
  next_action: string;
  confidence: number;
};

export const analyzeUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { updateId: string }) => {
    if (!input?.updateId) throw new Error("updateId required");
    return { updateId: input.updateId };
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // If an AI comment already exists, return it (cache-ish, avoid duplicate spend)
    const { data: existing } = await supabase
      .from("update_comments")
      .select("*")
      .eq("update_id", data.updateId)
      .eq("is_ai", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) return existing;

    const { data: upd, error: uErr } = await supabase
      .from("timeline_updates")
      .select("*, plant_logs(title, crop_type, variety, estimated_age_years, farms(name, lat, lng))")
      .eq("id", data.updateId)
      .maybeSingle();
    if (uErr) throw uErr;
    if (!upd) throw new Error("Update not found");

    const log = (upd as any).plant_logs;
    const farm = log?.farms;

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI unavailable");

    const prompt = `You are an agronomist for smallholder farmers in tropical Southeast Asia (Cambodia).
Analyze this crop update and return STRICT JSON with keys:
- observation (string, 1-2 sentences)
- suggestions (array of 2-4 short strings)
- problems (array of 0-3 short strings, likely issues)
- watch (array of 1-3 short strings, things to monitor next)
- next_action (string, one concrete recommended action)
- confidence (number 0-1)

Crop: ${log?.crop_type ?? "unknown"}${log?.variety ? " (" + log.variety + ")" : ""}
Log: ${log?.title ?? "-"}
Growth stage: ${upd.growth_stage}
Age: ${log?.estimated_age_years ?? "unknown"} years
Farm: ${farm?.name ?? "-"} (${farm?.lat ?? ""}, ${farm?.lng ?? ""})
Farmer notes: ${upd.notes || "(none)"}
Photos attached: ${upd.image_urls?.length ?? 0}

Reply with JSON only.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });
    if (res.status === 429) throw new Error("AI is rate-limited, try again in a moment");
    if (res.status === 402) throw new Error("AI credits exhausted — top up in workspace settings");
    if (!res.ok) throw new Error(`AI error ${res.status}`);

    const json = await res.json();
    const text: string = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: Analysis;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("AI returned invalid JSON");
    }

    const body = [
      parsed.observation && `**Observation:** ${parsed.observation}`,
      parsed.problems?.length && `**Possible problems:** ${parsed.problems.map((p) => "• " + p).join("\n")}`,
      parsed.suggestions?.length && `**Suggestions:** ${parsed.suggestions.map((p) => "• " + p).join("\n")}`,
      parsed.watch?.length && `**Watch:** ${parsed.watch.map((p) => "• " + p).join("\n")}`,
      parsed.next_action && `**Next action:** ${parsed.next_action}`,
    ].filter(Boolean).join("\n\n");

    // Use service role: AI-authored comments are server-generated, RLS blocks is_ai=true from users.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inserted, error } = await supabaseAdmin
      .from("update_comments")
      .insert({
        update_id: data.updateId,
        user_id: context.userId,
        author_name: "AI Agronomist",
        body,
        is_ai: true,
        confidence: parsed.confidence ?? null,
        category: "ai_analysis",
      })
      .select()
      .single();
    if (error) throw error;
    return inserted;
  });
