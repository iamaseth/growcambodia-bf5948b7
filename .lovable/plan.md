## Phase 2: Farmer Accounts & Farm Assignments

Preserves all existing data. Adds team-based farm access, a private admin "Farm Team" panel, farmer-scoped views, and a private submissions workflow with reviewer approval.

### 1. Database (single additive migration)

**`farm_members`** — team assignment
- Columns: `id`, `farm_id` (fk farms), `user_id` (fk auth.users), `member_role` (enum: owner/farmer/staff/viewer), `status` (enum: invited/active/suspended/removed), `invited_by`, `invited_at`, `accepted_at`, `created_at`, `updated_at`
- Unique `(farm_id, user_id)`
- Trigger backfills a `member_role=owner, status=active` row for every existing farm and for future `farms` inserts, so owners keep access via the same code path.

**`farmer_submissions`** — private review queue
- Columns per spec, plus `updated_at` trigger.
- `status` default `draft`; `submitted_at`/`reviewed_at`/`published_at` filled by transitions.
- On `approved` → server fn creates a normal `timeline_updates` row (that's how "published" content reaches the existing feed); submission row keeps review metadata private.

**Security helpers (SECURITY DEFINER, avoid RLS recursion)**
- `public.is_farm_member(_farm uuid, _user uuid)` → bool (active membership)
- `public.farm_member_role(_farm uuid, _user uuid)` → enum
- `public.can_manage_farm(_farm uuid, _user uuid)` → owner OR admin OR active staff
- `public.can_review_farm(_farm uuid, _user uuid)` → owner OR admin OR moderator OR active staff

**RLS policies**

`farm_members`:
- SELECT: `can_manage_farm(farm_id, auth.uid())` OR `user_id = auth.uid()` (farmer sees only own row)
- INSERT/UPDATE/DELETE: `can_manage_farm(...)` only. A DB trigger blocks non-managers from changing their own `member_role`/`status`.

`farms` (add, don't replace existing owner policy):
- SELECT: also allow `is_farm_member(id, auth.uid())`.

`plant_logs`:
- SELECT: also allow `is_farm_member(farm_id, auth.uid())`.

`timeline_updates` / `update_comments`: unchanged (public today per existing app).

`farmer_submissions`:
- SELECT: `submitted_by = auth.uid()` OR `can_review_farm(farm_id, auth.uid())`
- INSERT: `submitted_by = auth.uid()` AND `is_farm_member(farm_id, auth.uid())`
- UPDATE (author): only when `status IN ('draft','rejected')`; may set status to `submitted`; cannot set `reviewer_id`/`review_notes`/`published_at`
- UPDATE (reviewer): `can_review_farm(...)`; may set any review field
- DELETE: author while draft, or reviewer

Private fields (`farms.private_notes` if present, review notes, reviewer identity) are protected by never being selected in the farmer-facing fetchers **and** by column-level design: submissions' `review_notes` is only fetched via the reviewer path.

GRANTs on both tables to `authenticated` and `service_role` (no `anon`).

Storage: reuse existing `crop-photos` bucket for submission images.

### 2. Server functions (`src/lib/team.functions.ts`, `src/lib/submissions.functions.ts`)

All use `requireSupabaseAuth`. RLS enforces authority; server fns give clean typed APIs and let us look up user by email via admin client (guarded by an owner/admin check first).

- `listFarmMembers(farmId)`
- `inviteFarmMember({ farmId, email, role })` — verifies caller can_manage, then uses `supabaseAdmin.auth.admin` to resolve/create-invite the user, inserts membership row (`status='invited'`)
- `updateFarmMember({ id, role?, status? })`
- `resendInvite(memberId)`
- `listMyFarms()` — farms where caller is owner or active member (single query via RLS)
- `listFarmerFarmSummary(farmId)` — location (rounded if `photo_consent`/coord-consent off), crops, next visit, recent approved activity
- `createSubmission`, `updateSubmissionDraft`, `submitForReview`, `listMySubmissions`, `listReviewQueue`, `reviewSubmission({ id, decision, notes })` — on `approved` writes into `timeline_updates`

### 3. UI

**Farm Team panel** — new `<FarmTeamPanel farmId>` inside the existing `FarmDetail` (owner/admin only). Search by email, invite with role dropdown, list pending/active/suspended, actions: suspend / reactivate / remove / resend.

**Farmer home** — when the signed-in user has memberships but isn't the current farm's owner, the map/list surfaces their assigned farms via `listMyFarms`. New route `/my-farms` with cards: name, general area, crops, next visit, recent approved activity, big "Add Progress Update" and "Report a Problem" buttons that open the submission form pre-scoped to that farm.

**Mobile submission form** — `<SubmissionForm>` dialog:
- Farm select (from assigned farms) → plant log select (optional) → type (progress/measurement/problem/harvest) → camera-first photo picker (reuses existing photo upload + compression from `src/lib/photo.ts`) → short observation → optional measurement JSON (guided fields per type) → Save draft / Submit for review.
- Large tap targets, uses existing shadcn primitives.

**Reviewer queue** — `/review` route (owner/admin/moderator/staff): list pending submissions for farms they can review, view detail, approve (creates timeline update) / reject with private notes / return to draft.

**i18n** — extend the existing `t()` helper with new keys for every new label; English strings only, Khmer keys left as passthrough placeholders (no machine translation).

### 4. Privacy guarantees enforced in RLS + fetchers

- Farmers never receive `private_notes`, review notes, other members' phones, reviewer identity, or exact coords (unless owner opts in).
- Public/anon queries unchanged; nothing new is exposed to anon.
- Suspended/removed members: `is_farm_member` returns false → all farm/log/submission reads deny immediately.

### 5. Tests (Playwright + SQL)

Six personas seeded via `supabaseAdmin` in a test script under `/tmp/browser/phase2/`: owner, assigned farmer, unassigned farmer, suspended farmer, admin, anon. Assert PASS/FAIL for each row in the spec's test matrix and iterate until green.

### 6. Out of scope (explicitly not built)
Public feed changes, AI diagnosis, MicrobeBio recs, treatment calculators, cow/grass features, auto social posting.

### Build order
1. Migration (types regenerate on approval).
2. Server fns + team panel.
3. My Farms route + submission form.
4. Review queue.
5. Test matrix, fix, rerun.

Reply "go" to run the migration, or tell me what to adjust (e.g. skip review queue for now, drop `/my-farms` in favor of filtering the existing home, change the role set).
