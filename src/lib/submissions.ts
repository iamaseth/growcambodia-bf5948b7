import { supabase } from "@/integrations/supabase/client";

export type SubmissionType = "progress" | "measurement" | "problem" | "harvest";
export type SubmissionStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected"
  | "published"
  | "archived";

export type Submission = {
  id: string;
  farm_id: string;
  plant_log_id: string | null;
  submitted_by: string;
  submission_type: SubmissionType;
  title: string;
  observations: string | null;
  image_urls: string[];
  measurement_data: Record<string, unknown>;
  status: SubmissionStatus;
  reviewer_id: string | null;
  review_notes: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function createSubmission(input: {
  farm_id: string;
  plant_log_id?: string | null;
  submission_type: SubmissionType;
  title: string;
  observations?: string;
  image_urls?: string[];
  measurement_data?: Record<string, unknown>;
  submit?: boolean;
}, userId: string) {
  const row = {
    farm_id: input.farm_id,
    plant_log_id: input.plant_log_id ?? null,
    submitted_by: userId,
    submission_type: input.submission_type,
    title: input.title,
    observations: input.observations ?? null,
    image_urls: input.image_urls ?? [],
    measurement_data: input.measurement_data ?? {},
    status: input.submit ? ("submitted" as const) : ("draft" as const),
    submitted_at: input.submit ? new Date().toISOString() : null,
  };
  const { data, error } = await supabase.from("farmer_submissions").insert(row).select().single();
  if (error) throw error;
  return data as unknown as Submission;
}

export async function updateSubmissionDraft(id: string, patch: Partial<Omit<Submission, "id" | "status">>) {
  const { error } = await supabase.from("farmer_submissions").update(patch).eq("id", id);
  if (error) throw error;
}

export async function submitForReview(id: string) {
  const { error } = await supabase
    .from("farmer_submissions")
    .update({ status: "submitted", submitted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function fetchMySubmissions(userId: string): Promise<Submission[]> {
  const { data, error } = await supabase
    .from("farmer_submissions")
    .select("*")
    .eq("submitted_by", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Submission[];
}

export async function fetchReviewQueue(): Promise<Submission[]> {
  const { data, error } = await supabase
    .from("farmer_submissions")
    .select("*, farms(name), profiles!farmer_submissions_submitted_by_fkey(display_name)")
    .in("status", ["submitted", "under_review"])
    .order("submitted_at", { ascending: true });
  if (error) {
    const { data: d2, error: e2 } = await supabase
      .from("farmer_submissions")
      .select("*")
      .in("status", ["submitted", "under_review"])
      .order("submitted_at", { ascending: true });
    if (e2) throw e2;
    return (d2 ?? []) as unknown as Submission[];
  }
  return (data ?? []) as unknown as Submission[];
}

export async function reviewSubmission(
  id: string,
  decision: "approved" | "rejected" | "published",
  reviewerId: string,
  notes?: string,
) {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status: decision,
    reviewer_id: reviewerId,
    reviewed_at: now,
    review_notes: notes ?? null,
  };
  if (decision === "published") patch.published_at = now;
  const { error } = await supabase.from("farmer_submissions").update(patch).eq("id", id);
  if (error) throw error;

  if (decision === "approved" || decision === "published") {
    // Promote to a public timeline update so it reaches the community feed.
    const { data: sub } = await supabase
      .from("farmer_submissions")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (sub?.plant_log_id) {
      await supabase.from("timeline_updates").insert({
        log_id: sub.plant_log_id,
        user_id: sub.submitted_by,
        growth_stage: sub.submission_type,
        notes: sub.observations ?? sub.title,
        image_urls: sub.image_urls ?? [],
      });
    }
  }
}
