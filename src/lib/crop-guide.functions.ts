import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type LifecycleStage = { stage: string; duration: string };
type Disease = { name: string; symptoms: string; prevention: string };
type GuideShape = {
  growing_conditions: string;
  lifecycle: LifecycleStage[];
  diseases: Disease[];
};

export const getOrGenerateCropGuide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { cropName: string }) => {
    if (!input?.cropName || typeof input.cropName !== "string") throw new Error("cropName required");
    const trimmed = input.cropName.trim();
    if (trimmed.length === 0) throw new Error("cropName required");
    if (trimmed.length > 60) throw new Error("cropName too long");
    if (!/^[\p{L}0-9 \-']+$/u.test(trimmed)) throw new Error("Invalid crop name");
    return { cropName: trimmed };
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // Case-insensitive lookup
    const { data: existing } = await supabase
      .from("crop_knowledge")
      .select("*")
      .ilike("crop_name", data.cropName)
      .maybeSingle();

    if (existing) return existing;

    // Generate via Lovable AI
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI unavailable");

    const prompt = `You are an agronomist for smallholder farmers in tropical Southeast Asia (Cambodia).
Return a JSON object describing the crop "${data.cropName}" with keys:
- growing_conditions: string (climate, soil, water, sun; 2-3 sentences)
- lifecycle: array of { stage, duration } covering these stages in order: "Soil Preparation","Seed/Planting","Germination","Transplant","Vegetative","Flowering","Fruiting","Harvest" (omit any stage genuinely N/A for this crop).
- diseases: array of 3 items { name, symptoms, prevention } focused on diseases/pests common in tropical SE Asia.
Reply with JSON only, no prose.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new Error(`AI error ${res.status}`);
    const json = await res.json();
    const text: string = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: GuideShape;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("AI returned invalid JSON");
    }

    // Insert with service role: any authenticated user may trigger generation,
    // but the shared knowledge table itself is admin-write only via RLS.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inserted, error } = await supabaseAdmin
      .from("crop_knowledge")
      .insert({
        crop_name: data.cropName,
        growing_conditions: parsed.growing_conditions ?? "",
        lifecycle: (parsed.lifecycle ?? []) as unknown as any,
        diseases: (parsed.diseases ?? []) as unknown as any,
      })
      .select()
      .single();
    if (error) {
      const { data: again } = await supabase
        .from("crop_knowledge")
        .select("*")
        .ilike("crop_name", data.cropName)
        .maybeSingle();
      if (again) return again;
      throw error;
    }
    return inserted;
  });
